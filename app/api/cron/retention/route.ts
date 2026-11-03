import { NextResponse } from 'next/server';
import { cleanupExpiredTelemetry } from '@/lib/observability/retention';

export const dynamic = 'force-dynamic';

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // In production, CRON_SECRET must be configured
  if (!cronSecret) {
    // If running in development without CRON_SECRET configured, permit for testing
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }
    return false;
  }

  // 1. Check Bearer token in Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token === cronSecret) return true;
  }

  // 2. Check Vercel Cron specific header
  const vercelCronHeader = request.headers.get('x-vercel-cron-secret');
  if (vercelCronHeader && vercelCronHeader === cronSecret) {
    return true;
  }

  return false;
}

export async function GET(request: Request) {
  return handleRetentionCron(request);
}

export async function POST(request: Request) {
  return handleRetentionCron(request);
}

async function handleRetentionCron(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. Invalid or missing CRON_SECRET.' },
      { status: 401 }
    );
  }

  try {
    const result = await cleanupExpiredTelemetry();

    return NextResponse.json(
      {
        success: true,
        message: `Retention cleanup completed. ${result.totalDeleted} expired execution records deleted across ${result.batchesExecuted} batches.`,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[Cron Retention Cleanup Error]:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: 'An unexpected error occurred during retention cleanup.' },
      { status: 500 }
    );
  }
}

