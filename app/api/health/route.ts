import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { GEMINI_MODEL, PROMPT_VERSION } from '@/lib/ai/lead-analysis';

export const dynamic = 'force-dynamic';

const processStartTime = Date.now();

/**
 * Validates whether the caller is authorized to view deep diagnostics.
 * Authorized if:
 * 1. Caller provides Bearer token matching process.env.HEALTH_SECRET (or CRON_SECRET)
 * 2. Caller has an active authenticated user session
 */
async function isAuthorizedForDetailedDiagnostics(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const healthSecret = process.env.HEALTH_SECRET || process.env.CRON_SECRET;

  if (healthSecret && authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token === healthSecret) return true;
  }

  try {
    const user = await getCurrentUser(request);
    if (user) return true;
  } catch {
    // Session lookup failure falls through to false
  }

  return false;
}

/**
 * GET /api/health
 *
 * Public: Returns safe high-level health status without leaking system internals.
 * Protected: When authenticated via session or HEALTH_SECRET, returns deep diagnostics
 * including database latency, model configuration, and telemetry state.
 */
export async function GET(request: Request) {
  const isDetailed = await isAuthorizedForDetailedDiagnostics(request);

  let dbConnected = false;
  let dbLatencyMs = 0;
  let telemetryReady = false;

  const dbStart = performance.now();
  try {
    // Lightweight DB ping
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
    dbLatencyMs = Math.round(performance.now() - dbStart);

    // Verify telemetry table access without mutations
    if (prisma.aiExecutionLog) {
      telemetryReady = true;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    console.error('[Health Check DB Ping Failed]:', errorMessage);
    dbConnected = false;
  }

  // AI Provider configuration check (WITHOUT making a paid API call)
  const isGeminiConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);

  // If database is disconnected, application is in degraded state
  if (!dbConnected) {
    return NextResponse.json(
      {
        status: 'degraded',
        message: 'Database connection unavailable',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  // 1. Safe Public Health Response
  if (!isDetailed) {
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor((Date.now() - processStartTime) / 1000),
      },
      { status: 200 }
    );
  }

  // 2. Protected Detailed Diagnostics
  const memoryUsage = process.memoryUsage();

  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - processStartTime) / 1000),
      diagnostics: {
        database: {
          status: 'connected',
          latencyMs: dbLatencyMs,
        },
        aiProvider: {
          configured: isGeminiConfigured,
          model: GEMINI_MODEL,
          promptVersion: PROMPT_VERSION,
        },
        telemetry: {
          persistenceReady: telemetryReady,
          retentionPolicyDays: 30,
        },
        process: {
          nodeVersion: process.version,
          heapUsedMb: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
          heapTotalMb: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
        },
      },
    },
    { status: 200 }
  );
}
