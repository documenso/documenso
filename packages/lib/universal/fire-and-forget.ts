/**
 * Run a function without awaiting it or letting it affect the caller.
 *
 * Both synchronous throws and promise rejections are swallowed, making this
 * safe to call from request handlers and loaders for side work such as
 * analytics that must never block or fail the response.
 */
export const fireAndForget = (fn: () => unknown) => {
  try {
    void Promise.resolve(fn()).catch(() => null);
  } catch {
    // Swallow synchronous errors.
  }
};
