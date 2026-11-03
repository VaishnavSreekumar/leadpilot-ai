import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { assertLeadAccess } from '@/lib/auth/authorize';
import { checkRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    // Rate limiting
    const rateLimit = await checkRateLimit({
      key: `user:${user.id}:get_lead_detail`,
      maxRequests: 60,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return createRateLimitResponse(rateLimit);
    }

    // Authorize & prevent IDOR
    const access = await assertLeadAccess(id, user.id);
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    return NextResponse.json({ lead: access.lead }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database query failed';
    console.error('[GET /api/leads/[id] Error]:', message);

    return NextResponse.json(
      { error: 'Failed to fetch lead details. Please try again later.' },
      { status: 500 }
    );
  }
}
