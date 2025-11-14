import type { Context, Next } from 'hono';

import { AUTH_MIN_REQUEST_DURATION_MS } from '../../config';
import type { HonoAuthContext } from '../../types/context';

const timeout = async (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

/**
 * Mitigates against time-based side-channel attacks by ensuring that each request
 * takes at least AUTH_MIN_REQUEST_DURATION_MS milliseconds to complete.
 */
export const minimumDurationMiddleware = async (
  _c: Context<HonoAuthContext>,
  next: Next,
): Promise<void> => {
  const startTime = Date.now();

  await next();

  const elapsed = Date.now() - startTime;

  if (elapsed < AUTH_MIN_REQUEST_DURATION_MS) {
    await timeout(AUTH_MIN_REQUEST_DURATION_MS - elapsed);
  }
};
