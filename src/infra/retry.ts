export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  factor?: number;
  shouldRetry?: (err: unknown) => boolean;
  label?: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    attempts = 3,
    baseDelayMs = 1000,
    factor = 2,
    shouldRetry = () => true,
    label = "withRetry",
  } = opts;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i + 1 >= attempts || !shouldRetry(err)) break;
      const delay = baseDelayMs * factor ** i;
      console.warn(`[${label}] attempt ${i + 1}/${attempts} failed, retrying in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr;
}
