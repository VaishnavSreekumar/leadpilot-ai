import 'server-only';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { AiTimeoutError } from '@/lib/reliability/ai-request';
import type { LeadAnalysisResult } from '@/lib/ai/lead-analysis';
import type { AiExecutionLog } from '@prisma/client';

export type AiErrorType =
  | 'VALIDATION_ERROR'
  | 'PROVIDER_ERROR'
  | 'TIMEOUT_ERROR'
  | 'INTERNAL_ERROR';

export type AiExecutionStatus = 'SUCCESS' | 'FAILED';

export interface AiQualityMetrics {
  intentLevel?: string | null;
  engagementLevel?: string | null;
  requirementClarity?: string | null;
  uncertainFields: string[];
  keyRequirementsCount: number;
  objectionsCount: number;
  suggestedQuestionsCount: number;
}

export interface RecordAiExecutionInput {
  correlationId: string;
  leadId: string;
  userId?: string | null;
  model: string;
  promptVersion: string;
  status: AiExecutionStatus;
  latencyMs: number;
  attempts?: number;
  retryCount?: number;
  errorType?: AiErrorType | null;
  errorMessage?: string | null;
  retryOfCorrelationId?: string | null;
  quality?: Partial<AiQualityMetrics> | null;
  tokens?: {
    promptTokens?: number | null;
    responseTokens?: number | null;
    totalTokens?: number | null;
  } | null;
}

/**
 * Generates a standard cryptographically random UUIDv4 correlation ID.
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Sanitizes an error message by stripping sensitive secrets, API keys, and personal data.
 * Truncates output to a safe length (500 chars max) to prevent log bloat.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') return 'Unknown error';

  let sanitized = message
    // Strip Gemini / Google API keys
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
    // Strip generic key / token query params or bearer headers
    .replace(/([?&](?:key|api_key|token|secret)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(?:Bearer\s+)[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]')
    // Strip email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
    // Strip Indian / international phone numbers (10+ digits)
    .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, '[REDACTED_PHONE]')
    // Normalize multiple spaces/newlines
    .replace(/\s+/g, ' ')
    .trim();

  if (sanitized.length > 500) {
    sanitized = sanitized.slice(0, 497) + '...';
  }

  return sanitized;
}

/**
 * Classifies an unknown error into a standardized AiErrorType category.
 */
export function classifyAiError(err: unknown): {
  errorType: AiErrorType;
  sanitizedMessage: string;
} {
  const rawMessage = err instanceof Error ? err.message : String(err || 'Unknown error');
  const sanitizedMessage = sanitizeErrorMessage(rawMessage);
  const lowerMsg = rawMessage.toLowerCase();

  // 1. Timeout classification
  if (
    err instanceof AiTimeoutError ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('exceeded timeout') ||
    lowerMsg.includes('etimedout') ||
    lowerMsg.includes('deadline exceeded')
  ) {
    return { errorType: 'TIMEOUT_ERROR', sanitizedMessage };
  }

  // 2. Structured Output / JSON / Zod Validation classification
  if (
    lowerMsg.includes('schema validation failed') ||
    lowerMsg.includes('failed to parse gemini response as json') ||
    lowerMsg.includes('unexpected token') ||
    lowerMsg.includes('invalid json') ||
    lowerMsg.includes('empty response') ||
    lowerMsg.includes('zoderror')
  ) {
    return { errorType: 'VALIDATION_ERROR', sanitizedMessage };
  }

  // 3. Provider / Network / Quota classification
  if (
    lowerMsg.includes('quota') ||
    lowerMsg.includes('429') ||
    lowerMsg.includes('500') ||
    lowerMsg.includes('502') ||
    lowerMsg.includes('503') ||
    lowerMsg.includes('504') ||
    lowerMsg.includes('api key') ||
    lowerMsg.includes('permission_denied') ||
    lowerMsg.includes('unauthenticated') ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('gemini') ||
    lowerMsg.includes('generativeai')
  ) {
    return { errorType: 'PROVIDER_ERROR', sanitizedMessage };
  }

  // 4. Default Internal runtime error
  return { errorType: 'INTERNAL_ERROR', sanitizedMessage };
}

/**
 * Assesses the extraction quality of the lead analysis result.
 * Flags missing or uncertain extracted fields while preserving the
 * separation from deterministic lead scoring.
 */
export function assessExtractionQuality(
  result: Partial<LeadAnalysisResult>
): AiQualityMetrics {
  const uncertainFields: string[] = [];

  // Low intent indicates customer intent was weak or ambiguous
  if (!result.intentLevel || result.intentLevel === 'LOW') {
    uncertainFields.push('intentLevel');
  }

  // Unclear requirement clarity indicates stated configuration/budget lacked specificity
  if (!result.requirementClarity || result.requirementClarity === 'UNCLEAR') {
    uncertainFields.push('requirementClarity');
  }

  // Low engagement indicates customer message was terse or uninformative
  if (!result.engagementLevel || result.engagementLevel === 'LOW') {
    uncertainFields.push('engagementLevel');
  }

  // Missing or empty key requirements
  if (!result.keyRequirements || result.keyRequirements.length === 0) {
    uncertainFields.push('keyRequirements');
  }

  // Check if objections contains explicit uncertainty markers
  const objections = result.objections || [];
  const hasUncertaintyInObjections = objections.some((o) => {
    const lower = o.toLowerCase();
    return (
      lower.includes('unspecified') ||
      lower.includes('missing') ||
      lower.includes('not provided') ||
      lower.includes('unclear')
    );
  });
  if (hasUncertaintyInObjections || objections.length === 0) {
    uncertainFields.push('objections');
  }

  // Missing suggested questions
  if (!result.suggestedQuestions || result.suggestedQuestions.length === 0) {
    uncertainFields.push('suggestedQuestions');
  }

  return {
    intentLevel: result.intentLevel ?? null,
    engagementLevel: result.engagementLevel ?? null,
    requirementClarity: result.requirementClarity ?? null,
    uncertainFields,
    keyRequirementsCount: result.keyRequirements?.length ?? 0,
    objectionsCount: result.objections?.length ?? 0,
    suggestedQuestionsCount: result.suggestedQuestions?.length ?? 0,
  };
}

/**
 * Asynchronously persists an AI execution log into PostgreSQL.
 *
 * RESILIENCY GUARANTEE:
 * This function NEVER throws. If the database write fails, it catches the error,
 * logs a diagnostic warning, and returns null so the primary user workflow is never blocked.
 */
export async function recordAiExecution(
  input: RecordAiExecutionInput
): Promise<AiExecutionLog | null> {
  try {
    if (!prisma.aiExecutionLog || typeof prisma.aiExecutionLog.create !== 'function') {
      return null;
    }

    const log = await prisma.aiExecutionLog.create({
      data: {
        correlationId: input.correlationId,
        leadId: input.leadId,
        userId: input.userId ?? null,
        model: input.model,
        promptVersion: input.promptVersion,
        status: input.status,
        latencyMs: Math.max(0, Math.round(input.latencyMs)),
        attempts: Math.max(1, input.attempts ?? 1),
        retryCount: Math.max(0, input.retryCount ?? 0),
        errorType: input.errorType ?? null,
        errorMessage: input.errorMessage ? sanitizeErrorMessage(input.errorMessage) : null,
        retryOfCorrelationId: input.retryOfCorrelationId ?? null,
        intentLevel: input.quality?.intentLevel ?? null,
        engagementLevel: input.quality?.engagementLevel ?? null,
        requirementClarity: input.quality?.requirementClarity ?? null,
        uncertainFields: input.quality?.uncertainFields ?? [],
        keyRequirementsCount: input.quality?.keyRequirementsCount ?? 0,
        objectionsCount: input.quality?.objectionsCount ?? 0,
        suggestedQuestionsCount: input.quality?.suggestedQuestionsCount ?? 0,
        promptTokens: input.tokens?.promptTokens ?? null,
        responseTokens: input.tokens?.responseTokens ?? null,
        totalTokens: input.tokens?.totalTokens ?? null,
      },
    });

    return log;
  } catch (dbError) {
    console.error(
      '[Observability Warning]: Non-blocking telemetry persistence failed:',
      dbError instanceof Error ? dbError.message : dbError
    );
    return null;
  }
}
