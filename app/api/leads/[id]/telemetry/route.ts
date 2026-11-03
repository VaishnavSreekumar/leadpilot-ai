import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { assertLeadAccess } from '@/lib/auth/authorize';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/leads/[id]/telemetry
 *
 * Retrieves AI execution telemetry and quality metrics for a specific lead.
 * Protected by authentication and strict ownership verification (IDOR prevention).
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    // 1. Authentication check
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

    // 2. Strict IDOR Authorization Check
    const access = await assertLeadAccess(id, user.id);
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // 3. Query telemetry execution records (capped to latest 20)
    const logs = await prisma.aiExecutionLog.findMany({
      where: { leadId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        correlationId: true,
        model: true,
        promptVersion: true,
        status: true,
        latencyMs: true,
        attempts: true,
        retryCount: true,
        errorType: true,
        errorMessage: true,
        intentLevel: true,
        engagementLevel: true,
        requirementClarity: true,
        uncertainFields: true,
        keyRequirementsCount: true,
        objectionsCount: true,
        suggestedQuestionsCount: true,
        promptTokens: true,
        responseTokens: true,
        totalTokens: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        leadId: id,
        count: logs.length,
        logs,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[GET /api/leads/[id]/telemetry Error]:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: 'An unexpected error occurred while retrieving telemetry.' },
      { status: 500 }
    );
  }
}

