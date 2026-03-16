import { logger } from './logger.js';

export interface RetryOptions {
  /** Maximum number of attempts (including the first call). Default: 3 */
  maxAttempts?: number;
  /** Delay before the first retry in milliseconds. Default: 1000 */
  initialDelayMs?: number;
  /** Upper bound for the computed delay in milliseconds. Default: 30000 */
  maxDelayMs?: number;
  /** Multiplier applied to the delay after each failed attempt. Default: 2 */
  backoffMultiplier?: number;
  /** When true, adds random jitter (0-100% of delay) to prevent thundering herd. Default: true */
  jitter?: boolean;
  /** Predicate that decides whether a given error is worth retrying. Default: always retry */
  isRetryable?: (error: unknown) => boolean;
  /** Optional callback invoked before each retry sleep */
  onRetry?: (error: unknown, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'isRetryable'>> = {
  maxAttempts: 3,
  initialDelayMs: 1_000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Execute an async operation with exponential backoff retry.
 *
 * The delay between attempt `n` and `n+1` is:
 *   min(initialDelayMs * backoffMultiplier ^ (n - 1), maxDelayMs) + jitter
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier,
    jitter,
  } = { ...DEFAULT_OPTIONS, ...options };

  const isRetryable = options.isRetryable ?? (() => true);
  const onRetry = options.onRetry;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;

      const isLastAttempt = attempt === maxAttempts;
      const shouldRetry = !isLastAttempt && isRetryable(error);

      if (!shouldRetry) {
        throw error;
      }

      const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
      const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
      const jitterMs = jitter ? Math.random() * cappedDelay : 0;
      const totalDelay = Math.round(cappedDelay + jitterMs);

      logger.warn(
        {
          attempt,
          maxAttempts,
          nextAttempt: attempt + 1,
          delayMs: totalDelay,
          error: error instanceof Error ? error.message : String(error),
        },
        `Retry: attempt ${attempt}/${maxAttempts} failed, retrying in ${totalDelay}ms`,
      );

      onRetry?.(error, attempt);

      await sleep(totalDelay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
