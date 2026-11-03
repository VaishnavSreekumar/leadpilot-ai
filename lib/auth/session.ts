import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import type { User } from '@prisma/client';

export const SESSION_COOKIE_NAME = 'leadpilot_session';
export const SESSION_DURATION_DAYS = 7;

export interface SessionWithUser {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  user: User;
}

/**
 * Computes a SHA-256 cryptographic digest of a raw session token.
 * Only the digest is stored in the database to prevent session hijacking
 * in the event of database dumps or read replica compromise.
 */
export function hashSessionToken(token: string): string {
  if (!token || typeof token !== 'string') return '';
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Creates a cryptographically secure session for a user and stores its SHA-256 hash in the database.
 * The client receives the raw token; the database stores only the one-way digest.
 */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      token: tokenHash,
      userId,
      expiresAt,
    },
  });

  return { token: rawToken, expiresAt };
}

/**
 * Validates a raw session token string against the database by hashing it first.
 * Returns the associated User if active, or null if invalid/expired.
 */
export async function validateSessionToken(token: string): Promise<User | null> {
  if (!token || typeof token !== 'string') return null;

  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!session) return null;

  // Check if session has expired
  if (session.expiresAt.getTime() <= Date.now()) {
    // Opportunistically delete expired session
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
}

/**
 * Retrieves the currently authenticated user from either:
 * 1. The HTTP-only `leadpilot_session` cookie
 * 2. An optional `Authorization: Bearer <token>` header (useful for API clients & tests)
 */
export async function getCurrentUser(request?: Request): Promise<User | null> {
  // 1. Check Authorization header if request is provided
  if (request) {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const bearerToken = authHeader.slice(7).trim();
      const user = await validateSessionToken(bearerToken);
      if (user) return user;
    }
  }

  // 2. Check session cookie
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie || !sessionCookie.value) return null;

    return await validateSessionToken(sessionCookie.value);
  } catch {
    // cookies() might fail if called outside a request context
    return null;
  }
}

/**
 * Destroys a session by token in the database using the token's SHA-256 digest.
 */
export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  const tokenHash = hashSessionToken(token);
  await prisma.session.deleteMany({
    where: { token: tokenHash },
  }).catch(() => {});
}

/**
 * Helper to get the current session token from cookies
 */
export async function getCurrentSessionToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

