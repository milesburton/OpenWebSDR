export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  factor: number;
  retryIf?: (error: unknown) => boolean;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 200,
  maxDelayMs: 5000,
  factor: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;
  let delayMs = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (opts.retryIf && !opts.retryIf(err)) {
        throw err;
      }

      if (attempt < opts.maxAttempts) {
        await sleep(delayMs);
        delayMs = Math.min(delayMs * opts.factor, opts.maxDelayMs);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
