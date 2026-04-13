/**
 * Race a promise against a timeout. Returns `null` if the timeout
 * fires before the promise settles.
 */
export const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) =>
  await Promise.race<T | null>([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);

/**
 * Wrapper around `fetch` that aborts the request after `timeoutMs`.
 * Throws with a descriptive message on timeout.
 */
export const fetchWithTimeout = async (
  input: string | URL | Request,
  init: RequestInit & { timeoutMs: number },
) => {
  const { timeoutMs, ...fetchInit } = init;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...fetchInit, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }

    throw err;
  } finally {
    clearTimeout(timeout);
  }
};
