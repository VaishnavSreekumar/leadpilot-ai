import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { analyzeLeadWithGemini, GEMINI_MODEL, PROMPT_VERSION } from '@/lib/ai/lead-analysis';
import { calculateLeadScore } from '@/lib/scoring/lead-score';
import { getCurrentUser } from '@/lib/auth/session';
import { checkRateLimit, createRateLimitResponse } from '@/lib/security/rate-limit';
import { acquireAnalysisLock } from '@/lib/reliability/cooldown';
import {
  generateCorrelationId,
  recordAiExecution,
  classifyAiError,
  assessExtractionQuality,
} from '@/lib/observability/telemetry';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
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

    // 2. Server-side Rate Limiting (20 analysis requests / 60s per user)
    const rateLimit = await checkRateLimit({
      key: `user:${user.id}:analyze`,
      maxRequests: 20,
      windowSeconds: 60,
    });

    if (!rateLimit.success) {
      return createRateLimitResponse(rateLimit, 'Rate limit exceeded for lead analysis. Please wait.');
    }

    // 3. Retrieve authoritative lead from DB
    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Cross-user IDOR protection
    if (lead.userId && lead.userId !== user.id) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Parse optional request options (e.g. force/retry)
    let isForceRetry = false;
    try {
      const body = await request.json();
      if (body && typeof body.force === 'boolean') {
        isForceRetry = body.force;
      }
    } catch {
      // Body is optional; no-op if empty or non-JSON
    }

    // Cost Guard / Re-analysis Policy:
    // If analysis is already completed and this is NOT an explicit retry, reuse existing result
    if (lead.aiAnalysisStatus === 'COMPLETED' && !isForceRetry) {
      const scoreResult = calculateLeadScore({
        intentLevel: lead.aiIntentLevel,
        buyingTimeline: lead.buyingTimeline,
        budgetInr: lead.budgetInr,
        requirementClarity: lead.aiRequirementClarity,
        engagementLevel: lead.aiEngagementLevel,
      });

      return NextResponse.json(
        {
          success: true,
          lead,
          breakdown: scoreResult.breakdown,
          message: 'Existing completed analysis reused.',
        },
        { status: 200 }
      );
    }

    // Atomic Cooldown Guard (10 seconds) and In-Flight Concurrency Lock
    const lockResult = await acquireAnalysisLock(id);
    if (!lockResult.acquired) {
      if (lockResult.reason === 'in_progress') {
        return NextResponse.json(
          {
            error: 'An analysis is currently in progress for this lead. Please wait.',
            inProgress: true,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error: 'Cooldown active. Please wait 10 seconds before requesting another analysis.',
          cooldownRemaining: lockResult.cooldownRemaining ?? 10,
        },
        { status: 429 }
      );
    }

    const lockToken = lockResult.acquiredAt;
    const correlationId = generateCorrelationId();
    const executionStartTime = performance.now();

    try {
      // Execute Gemini analysis with bounded retry (max 2 attempts inside analyzeLeadWithGemini)
      const analysis = await analyzeLeadWithGemini(
        {
          name: lead.name,
          location: lead.location,
          propertyRequirement: lead.propertyRequirement,
          budgetInr: lead.budgetInr,
          buyingTimeline: lead.buyingTimeline,
          customerMessage: lead.customerMessage,
        },
        undefined,
        { correlationId }
      );

      // Calculate deterministic lead score & priority
      const scoreResult = calculateLeadScore({
        intentLevel: analysis.intentLevel,
        buyingTimeline: lead.buyingTimeline,
        budgetInr: lead.budgetInr,
        requirementClarity: analysis.requirementClarity,
        engagementLevel: analysis.engagementLevel,
      });

      // Fencing Token / Lock Ownership Verification:
      // Verify that this execution still owns the lock before persisting.
      // If another execution reclaimed the lock after the 60s timeout, updateMany will update 0 rows.
      if (typeof prisma.lead.updateMany === 'function' && lockToken) {
        const fencedCheck = await prisma.lead.updateMany({
          where: {
            id,
            aiAnalysisStatus: 'PENDING',
            updatedAt: lockToken,
          },
          data: {
            aiAnalysisStatus: 'PENDING',
          },
        });

        if (fencedCheck.count === 0) {
          console.warn('[Analyze Lock Fencing Warning]: Stale analysis detected. Lock was reclaimed by newer request. Discarding stale write.');
          const currentAuthoritativeLead = await prisma.lead.findUnique({ where: { id } });
          return NextResponse.json(
            {
              success: true,
              correlationId,
              lead: currentAuthoritativeLead || lead,
              breakdown: scoreResult.breakdown,
              staleDiscarded: true,
            },
            {
              status: 200,
              headers: { 'x-correlation-id': correlationId },
            }
          );
        }
      }

      // Persist AI fields and canonical scoring fields (zero breakdown persisted)
      const updatedLead = await prisma.lead.update({
        where: { id },
        data: {
          aiSummary: analysis.summary,
          aiIntent: analysis.intent,
          aiKeyRequirements: analysis.keyRequirements,
          aiObjections: analysis.objections,
          aiRecommendedNextAction: analysis.recommendedNextAction,
          aiSuggestedResponse: analysis.suggestedResponse,
          aiSuggestedQuestions: analysis.suggestedQuestions,
          aiIntentLevel: analysis.intentLevel,
          aiEngagementLevel: analysis.engagementLevel,
          aiRequirementClarity: analysis.requirementClarity,
          aiAnalyzedAt: new Date(),
          aiAnalysisStatus: 'COMPLETED',
          leadScore: scoreResult.score,
          leadPriority: scoreResult.priority,
        },
      });

      // Asynchronous non-blocking telemetry recording
      const executionLatencyMs = Math.round(performance.now() - executionStartTime);
      const qualityMetrics = assessExtractionQuality(analysis);
      const telemetryMetadata = analysis.telemetry;

      await recordAiExecution({
        correlationId,
        leadId: id,
        userId: user.id,
        model: telemetryMetadata?.model || GEMINI_MODEL,
        promptVersion: telemetryMetadata?.promptVersion || PROMPT_VERSION,
        status: 'SUCCESS',
        latencyMs: telemetryMetadata?.latencyMs ?? executionLatencyMs,
        attempts: telemetryMetadata?.attempts ?? 1,
        retryCount: telemetryMetadata?.retryCount ?? 0,
        quality: qualityMetrics,
        tokens: telemetryMetadata?.tokens,
      });

      return NextResponse.json(
        {
          success: true,
          correlationId,
          lead: updatedLead,
          breakdown: scoreResult.breakdown,
        },
        {
          status: 200,
          headers: { 'x-correlation-id': correlationId },
        }
      );
    } catch (analysisError) {
      const executionLatencyMs = Math.round(performance.now() - executionStartTime);
      const classified = classifyAiError(analysisError);
      console.error(`[Analyze Lead Processing Error] [correlationId: ${correlationId}]:`, classified.sanitizedMessage);

      // Failure Safety:
      // If a previous COMPLETED analysis existed, preserve it.
      // Otherwise set aiAnalysisStatus to FAILED.
      if (lead.aiAnalysisStatus !== 'COMPLETED') {
        await prisma.lead.update({
          where: { id },
          data: { aiAnalysisStatus: 'FAILED' },
        });
      } else {
        await prisma.lead.update({
          where: { id },
          data: { aiAnalysisStatus: 'COMPLETED' },
        });
      }

      // Asynchronous non-blocking telemetry recording for failure
      await recordAiExecution({
        correlationId,
        leadId: id,
        userId: user.id,
        model: GEMINI_MODEL,
        promptVersion: PROMPT_VERSION,
        status: 'FAILED',
        latencyMs: executionLatencyMs,
        attempts: 2,
        retryCount: 1,
        errorType: classified.errorType,
        errorMessage: classified.sanitizedMessage,
      });

      return NextResponse.json(
        {
          error: 'AI analysis temporarily unavailable. Please retry shortly.',
          correlationId,
        },
        {
          status: 500,
          headers: { 'x-correlation-id': correlationId },
        }
      );
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Server error';
    console.error('[POST /api/leads/[id]/analyze Fatal Error]:', errMessage);

    return NextResponse.json(
      { error: 'An unexpected error occurred while analyzing the lead.' },
      { status: 500 }
    );
  }
}
