/**
 * In-process circuit breaker for the document conversion service.
 *
 * Behaviour: any failure opens the circuit for `COOLDOWN_MS`. While open,
 * callers should fail fast without hitting the network. The first request
 * after the cooldown is allowed through and either closes the circuit (on
 * success) or re-opens it for another cooldown window (on failure).
 *
 * State is stored on `globalThis` so it survives Vite/Remix HMR in dev and
 * is unambiguously process-wide. This module is intentionally pure and
 * synchronous: no I/O, no logger import — callers handle observability.
 */

const COOLDOWN_MS = 30_000;

declare global {
  // eslint-disable-next-line no-var
  var __documensoConversionCircuitOpenedAt: number | null | undefined;
}

export const isCircuitOpen = (): boolean => {
  const openedAt = globalThis.__documensoConversionCircuitOpenedAt;

  if (!openedAt) {
    return false;
  }

  return Date.now() - openedAt < COOLDOWN_MS;
};

export const recordSuccess = (): void => {
  globalThis.__documensoConversionCircuitOpenedAt = null;
};

export const recordFailure = (): void => {
  globalThis.__documensoConversionCircuitOpenedAt = Date.now();
};
