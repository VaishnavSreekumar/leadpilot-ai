import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { checkRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { executeLeadAnalysisRetry } from '@/lib/reliability/failure-recovery';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/leads/[id]/retry
 *
 * Safely retries a failed lead analysis.
 * Enforces authentication, IDOR ownership, rate-limiting, and concurrency locks.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Valid Lead ID is required' }, { status: 400 });
    }

    // Rate limiting: 10 retries per minute per user
    const rateLimit = await checkRateLimit({
      key: `user:${user.id}:retry`,
      maxRequests: 10,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return createRateLimitResponse(rateLimit, 'Retry rate limit exceeded. Please wait.');
    }

    let originalCorrelationId: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.originalCorrelationId === 'string') {
        originalCorrelationId = body.originalCorrelationId;
      }
    } catch {
      // Body is optional
    }

    const result = await executeLeadAnalysisRetry({
      leadId: id,
      userId: user.id,
      originalCorrelationId,
    });

    return NextResponse.json(
      {
        success: result.success,
        correlationId: result.correlationId,
        lead: result.lead,
        breakdown: result.breakdown,
        error: result.error,
      },
      {
        status: result.statusCode,
        headers: { 'x-correlation-id': result.correlationId },
      }
    );
  } catch (error) {
    console.error(
      '[POST /api/leads/[id]/retry Fatal Error]:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: 'An unexpected error occurred during analysis retry.' },
      { status: 500 }
    );
  }
}

