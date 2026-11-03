import 'server-only';
import { prisma } from '@/lib/db';
import { assertLeadAccess } from '@/lib/auth/authorize';
import { acquireAnalysisLock } from './cooldown';
import { analyzeLeadWithGemini, GEMINI_MODEL, PROMPT_VERSION } from '@/lib/ai/lead-analysis';
import { calculateLeadScore } from '@/lib/scoring/lead-score';
import {
  generateCorrelationId,
  recordAiExecution,
  classifyAiError,
  assessExtractionQuality,
} from '@/lib/observability/telemetry';

export type RetryEligibility =
  | { eligible: true; reason: string }
  | { eligible: false; reason: string };

/**
 * Determines whether a failed execution is eligible for a safe retry.
 * Only transient errors (timeouts, provider issues, temporary validation hiccups) are eligible.
 */
export function isFailureEligibleForRetry(errorType: string | null | undefined): RetryEligibility {
  if (!errorType) {
    return { eligible: true, reason: 'Unspecified failure type; retry permitted under cooldown.' };
  }

  const normalized = errorType.toUpperCase().trim();

  if (normalized === 'TIMEOUT_ERROR') {
    return { eligible: true, reason: 'Timeout errors are transient and eligible for retry.' };
  }

  if (normalized === 'PROVIDER_ERROR') {
    return { eligible: true, reason: 'Provider and quota errors are transient and eligible for retry.' };
  }

  if (normalized === 'VALIDATION_ERROR') {
    return { eligible: true, reason: 'Schema validation hiccups are eligible for retry.' };
  }

  if (normalized === 'INTERNAL_ERROR') {
    return { eligible: false, reason: 'Internal errors require inspection before retrying.' };
  }

  return { eligible: true, reason: 'Eligible for safe bounded retry.' };
}

export interface RetryExecutionResult {
  success: boolean;
  correlationId: string;
  lead?: unknown;
  breakdown?: unknown;
  error?: string;
  statusCode: number;
}

/**
 * Safely executes a retry for an existing lead with concurrency and cooldown enforcement.
 * Links the retry execution to the original correlation ID in telemetry.
 */
export async function executeLeadAnalysisRetry(params: {
  leadId: string;
  userId: string;
  originalCorrelationId?: string | null;
}): Promise<RetryExecutionResult> {
  const { leadId, userId, originalCorrelationId } = params;

  // 1. Authorization check
  const access = await assertLeadAccess(leadId, userId);
  if (!access.authorized) {
    return {
      success: false,
      correlationId: originalCorrelationId || 'unauthorized',
      error: access.error,
      statusCode: access.status,
    };
  }

  const lead = access.lead;

  // 2. Cooldown Guard & Concurrency Lock
  const lockResult = await acquireAnalysisLock(leadId);
  if (!lockResult.acquired) {
    if (lockResult.reason === 'in_progress') {
      return {
        success: false,
        correlationId: originalCorrelationId || 'lock_conflict',
        error: 'An analysis is currently in progress for this lead. Please wait.',
        statusCode: 409,
      };
    }
    return {
      success: false,
      correlationId: originalCorrelationId || 'cooldown_active',
      error: `Cooldown active. Please wait ${lockResult.cooldownRemaining ?? 10} seconds before retrying.`,
      statusCode: 429,
    };
  }

  const lockToken = lockResult.acquiredAt;
  const newCorrelationId = generateCorrelationId();
  const startTime = performance.now();

  try {
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
      { correlationId: newCorrelationId }
    );

    const scoreResult = calculateLeadScore({
      intentLevel: analysis.intentLevel,
      buyingTimeline: lead.buyingTimeline,
      budgetInr: lead.budgetInr,
      requirementClarity: analysis.requirementClarity,
      engagementLevel: analysis.engagementLevel,
    });

    // Lock Ownership Fencing Check
    if (typeof prisma.lead.updateMany === 'function' && lockToken) {
      const fencedCheck = await prisma.lead.updateMany({
        where: {
          id: leadId,
          aiAnalysisStatus: 'PENDING',
          updatedAt: lockToken,
        },
        data: { aiAnalysisStatus: 'PENDING' },
      });

      if (fencedCheck.count === 0) {
        const currentLead = await prisma.lead.findUnique({ where: { id: leadId } });
        return {
          success: true,
          correlationId: newCorrelationId,
          lead: currentLead || lead,
          breakdown: scoreResult.breakdown,
          statusCode: 200,
        };
      }
    }

    // Persist updated lead
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
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

    const executionLatencyMs = Math.round(performance.now() - startTime);
    const quality = assessExtractionQuality(analysis);

    // Record SUCCESS telemetry linked to original correlation ID
    await recordAiExecution({
      correlationId: newCorrelationId,
      leadId,
      userId,
      model: analysis.telemetry?.model || GEMINI_MODEL,
      promptVersion: analysis.telemetry?.promptVersion || PROMPT_VERSION,
      status: 'SUCCESS',
      latencyMs: analysis.telemetry?.latencyMs ?? executionLatencyMs,
      attempts: analysis.telemetry?.attempts ?? 1,
      retryCount: (analysis.telemetry?.retryCount ?? 0) + 1, // Reflect retry
      retryOfCorrelationId: originalCorrelationId || null,
      quality,
      tokens: analysis.telemetry?.tokens,
    });

    return {
      success: true,
      correlationId: newCorrelationId,
      lead: updatedLead,
      breakdown: scoreResult.breakdown,
      statusCode: 200,
    };
  } catch (err) {
    const executionLatencyMs = Math.round(performance.now() - startTime);
    const classified = classifyAiError(err);

    // Preservation of previous completed analysis:
    // If the lead was already COMPLETED, preserve it rather than corrupting it to FAILED
    if (lead.aiAnalysisStatus !== 'COMPLETED') {
      await prisma.lead.update({
        where: { id: leadId },
        data: { aiAnalysisStatus: 'FAILED' },
      });
    }

    // Record FAILED telemetry linked to original correlation ID
    await recordAiExecution({
      correlationId: newCorrelationId,
      leadId,
      userId,
      model: GEMINI_MODEL,
      promptVersion: PROMPT_VERSION,
      status: 'FAILED',
      latencyMs: executionLatencyMs,
      attempts: 2,
      retryCount: 1,
      retryOfCorrelationId: originalCorrelationId || null,
      errorType: classified.errorType,
      errorMessage: classified.sanitizedMessage,
    });

    return {
      success: false,
      correlationId: newCorrelationId,
      error: 'AI analysis retry temporarily unavailable. Please try again shortly.',
      statusCode: 500,
    };
  }
}

