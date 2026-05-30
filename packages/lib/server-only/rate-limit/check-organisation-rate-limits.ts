import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TRateLimitArray } from '../../types/subscription';
import { createRateLimit } from './rate-limit';
import type { LimitCounter, RateLimitEntry } from './types';

type CheckOrganisationRateLimitsOptions = {
  organisationId: string;
  counter: LimitCounter;
  entries: TRateLimitArray;
  count: number;
};

/**
 * Enforce an organisation's windowed rate limits.
 *
 * Each window is checked against a bucketed counter keyed to the organisation.
 * `count` units are consumed per check (e.g. a batch of reminder emails).
 */
export const checkOrganisationRateLimits = async (opts: CheckOrganisationRateLimitsOptions): Promise<void> => {
  for (const entry of opts.entries) {
    // Zod has validated the window against /^\d+[smhd]$/, which matches WindowStr.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const window = entry.window as RateLimitEntry['window'];

    const limiter = createRateLimit({
      action: `org.${opts.counter}.${window}`,
      max: entry.max,
      window,
    });

    // There's no real IP, so we just use the organisation ID as a key.
    const result = await limiter.check({ ip: `org:${opts.organisationId}`, count: opts.count });

    if (result.isLimited) {
      throw new AppError(AppErrorCode.TOO_MANY_REQUESTS, {
        // Note: Update the organisation-rate-limits.spec.ts message if you change this value.
        // Used in the test to differentiate between the global and organisation rate limits.
        message: 'Too many requests, please try again later. Contact support if you require higher limits.',
        headers: {
          'X-RateLimit-Limit': String(entry.max),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.reset.getTime() / 1000)),
          'Retry-After': String(Math.max(1, Math.ceil((result.reset.getTime() - Date.now()) / 1000))),
        },
      });
    }
  }
};
