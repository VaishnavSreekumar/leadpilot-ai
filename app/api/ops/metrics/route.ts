import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getOperationalMetrics, type MetricsDateRange } from '@/lib/observability/metrics';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ops/metrics
 *
 * Retrieves aggregated operational metrics for the authenticated user.
 * Supports date range filtering via ?range=24h|7d|30d|all (defaults to 7d).
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawRange = searchParams.get('range') || '7d';

    const validRanges: MetricsDateRange[] = ['24h', '7d', '30d', 'all'];
    const range: MetricsDateRange = validRanges.includes(rawRange as MetricsDateRange)
      ? (rawRange as MetricsDateRange)
      : '7d';

    // Scoped strictly to the authenticated user for data isolation
    const report = await getOperationalMetrics({
      userId: user.id,
      range,
    });

    return NextResponse.json(
      {
        success: true,
        report,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[GET /api/ops/metrics Error]:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: 'An unexpected error occurred while calculating metrics.' },
      { status: 500 }
    );
  }
}

