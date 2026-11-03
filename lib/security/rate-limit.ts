import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export interface RateLimitOptions {
  key: string;
  maxRequests: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
}

/**
 * Validates whether an input string is a valid IPv4 or IPv6 address.
 */
export function isValidIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  if (trimmed.length < 2 || trimmed.length > 45) return false;

  // IPv4 check
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(trimmed)) return true;

  // IPv6 check
  const ipv6Regex = /^(?:[a-fA-F0-9]{1,4}:){1,7}[a-fA-F0-9]{1,4}$|^::1$|^::$/;
  return ipv6Regex.test(trimmed);
}

/**
 * Extracts a verified client IP address from trusted proxy headers.
 *
 * Trusted Proxy Policy (Vercel & Standard Reverse Proxies):
 * 1. Prioritizes platform-authenticated edge headers (`x-real-ip`, `cf-connecting-ip`)
 *    which are overwritten by the edge routing layer and cannot be spoofed by clients.
 * 2. If inspecting `x-forwarded-for`, extracts the rightmost (last) entry appended by
 *    the trusted ingress proxy, preventing spoofed leftmost entries from bypassing limits.
 * 3. Validates IP syntax (IPv4/IPv6) and safely falls back to '127.0.0.1' for local dev.
 */
export function getClientIp(request: Request): string {
  // 1. Edge-authenticated single IP headers (Vercel / Cloudflare)
  const realIp = request.headers.get('x-real-ip');
  if (realIp && isValidIp(realIp)) {
    return realIp.trim();
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp && isValidIp(cfConnectingIp)) {
    return cfConnectingIp.trim();
  }

  // 2. Multi-hop X-Forwarded-For: trust the rightmost proxy-added hop
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const hops = forwardedFor.split(',').map((h) => h.trim()).filter(Boolean);
    // The rightmost hop is the IP presented directly to the ingress load balancer
    const rightmostIp = hops[hops.length - 1];
    if (rightmostIp && isValidIp(rightmostIp)) {
      return rightmostIp;
    }
  }

  return '127.0.0.1';
}

/**
 * Atomically checks and increments a rate-limit counter in PostgreSQL.
 * Serverless-safe: Works concurrently across multiple Vercel instances.
 *
 * Uses an atomic SQL statement (INSERT ... ON CONFLICT DO UPDATE) to guarantee
 * concurrency safety without race conditions or in-memory state.
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { key, maxRequests, windowSeconds } = options;
  const now = new Date();
  const newResetAt = new Date(now.getTime() + windowSeconds * 1000);

  // Opportunistic cleanup: 5% chance to purge expired records so storage doesn't grow indefinitely
  if (Math.random() < 0.05 && prisma.rateLimit?.deleteMany) {
    try {
      const p = prisma.rateLimit.deleteMany({
        where: { resetAt: { lt: new Date(now.getTime() - 3600 * 1000) } },
      });
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    } catch {
      // no-op
    }
  }

  try {
    const result = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt", "createdAt", "updatedAt")
      VALUES (${key}, 1, ${newResetAt}, NOW(), NOW())
      ON CONFLICT ("key") DO UPDATE
      SET 
        "count" = CASE 
          WHEN "RateLimit"."resetAt" <= NOW() THEN 1 
          ELSE "RateLimit"."count" + 1 
        END,
        "resetAt" = CASE 
          WHEN "RateLimit"."resetAt" <= NOW() THEN ${newResetAt} 
          ELSE "RateLimit"."resetAt" 
        END,
        "updatedAt" = NOW()
      RETURNING "count", "resetAt";
    `;

    if (!result || result.length === 0) {
      // Fallback: allow request if unexpected empty result
      return {
        success: true,
        limit: maxRequests,
        remaining: maxRequests - 1,
        resetAt: newResetAt,
        retryAfterSeconds: 0,
      };
    }

    const { count, resetAt } = result[0];
    const isAllowed = count <= maxRequests;
    const remaining = Math.max(0, maxRequests - count);
    const retryAfterSeconds = Math.max(1, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000));

    return {
      success: isAllowed,
      limit: maxRequests,
      remaining,
      resetAt: new Date(resetAt),
      retryAfterSeconds: isAllowed ? 0 : retryAfterSeconds,
    };
  } catch (error) {
    // Fail-open for rate limiter errors to prevent database blips from causing full application denial-of-service
    console.error('[Rate Limiter DB Error]:', error instanceof Error ? error.message : error);
    return {
      success: true,
      limit: maxRequests,
      remaining: 1,
      resetAt: newResetAt,
      retryAfterSeconds: 0,
    };
  }
}

/**
 * Standard HTTP rate-limit response with proper RFC headers
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  customMessage?: string
): NextResponse {
  const resetUnix = Math.floor(result.resetAt.getTime() / 1000);

  return NextResponse.json(
    {
      error: customMessage || `Rate limit exceeded. Please try again in ${result.retryAfterSeconds} seconds.`,
      retryAfter: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(resetUnix),
      },
    }
  );
}
