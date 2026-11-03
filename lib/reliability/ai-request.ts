/**
 * LeadPilot AI — AI Request Reliability Utilities
 *
 * Implements:
 * - Request timeouts via Promise.race / AbortSignal
 * - Bounded retry classification (transient vs non-retryable errors)
 * - Exponential backoff jitter
 */

export const DEFAULT_AI_TIMEOUT_MS = 15_000; // 15 seconds serverless safe timeout

export class AiTimeoutError extends Error {
  constructor(message = 'AI provider request timed out', public readonly timeoutMs = DEFAULT_AI_TIMEOUT_MS) {
    super(message);
    this.name = 'AiTimeoutError';
  }
}

/**
 * Wraps an async operation with a bounded timeout and an AbortSignal.
 * When timeout fires, controller.abort() is called to explicitly cancel
 * the underlying HTTP network request (via @google/genai abortSignal / fetch).
 */
export async function withTimeout<T>(
  operation: Promise<T> | ((signal: AbortSignal) => Promise<T>),
  timeoutMs: number = DEFAULT_AI_TIMEOUT_MS,
  label = 'AI request'
): Promise<T> {
  const controller = new AbortController();
  let timerId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      // Actively cancel the underlying HTTP request via AbortSignal
      controller.abort(new AiTimeoutError(`${label} exceeded timeout of ${timeoutMs}ms`, timeoutMs));
      reject(new AiTimeoutError(`${label} exceeded timeout of ${timeoutMs}ms`, timeoutMs));
    }, timeoutMs);
  });

  try {
    const promise = typeof operation === 'function' ? operation(controller.signal) : operation;
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timerId) {
      clearTimeout(timerId);
    }
  }
}

/**
 * Determines whether an error is permanently non-retryable.
 *
 * Non-retryable errors:
 * - Invalid API key / Authentication credentials
 * - Permission denied / Unauthorized access
 * - Invalid model arguments
 *
 * Transient errors (ELIGIBLE for bounded retry):
 * - 429 Quota / Rate limit
 * - 500 / 502 / 503 / 504 Provider internal or gateway errors
 * - Network connection drops / ECONNRESET / ETIMEDOUT
 * - Request timeouts (AiTimeoutError)
 * - Temporary empty responses or JSON parse glitches
 */
export function isNonRetryableError(error: unknown): boolean {
  if (!error) return false;
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();

  // Authentication & permission errors are permanent
  if (
    msg.includes('api key not valid') ||
    msg.includes('api_key_invalid') ||
    msg.includes('permission_denied') ||
    msg.includes('unauthenticated') ||
    msg.includes('unauthorized') ||
    msg.includes('invalid api key')
  ) {
    return true;
  }

  return false;
}

/**
 * Calculates exponential backoff delay with bounded jitter.
 *
 * Attempt 1: ~500ms
 * Attempt 2: ~1000ms
 */
export function calculateBackoffMs(attempt: number, baseMs = 500, maxMs = 2000): number {
  const exponential = baseMs * Math.pow(2, attempt - 1);
  // Add small jitter (±10%) to prevent thundering herd across concurrent serverless instances
  const jitter = (Math.random() * 0.2 - 0.1) * exponential;
  return Math.min(maxMs, Math.max(100, Math.round(exponential + jitter)));
}

