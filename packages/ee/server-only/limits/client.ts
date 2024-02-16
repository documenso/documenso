import { APP_BASE_URL } from '@documenso/lib/constants/app';

import { FREE_PLAN_LIMITS } from './constants';
import type { TLimitsResponseSchema } from './schema';
import { ZLimitsResponseSchema } from './schema';

export type GetLimitsOptions = {
  headers?: Record<string, string>;
  teamId?: number | null;
};

export const getLimits = async ({ headers, teamId }: GetLimitsOptions = {}) => {
  const requestHeaders = headers ?? {};

  const url = new URL('/api/limits', APP_BASE_URL() ?? 'http://localhost:3000');

  if (teamId) {
    requestHeaders['team-id'] = teamId.toString();
  }

  return fetch(url, {
    headers: {
      ...requestHeaders,
    },
  })
    .then(async (res) => res.json())
    .then((res) => ZLimitsResponseSchema.parse(res))
    .catch((_err) => {
      return {
        quota: FREE_PLAN_LIMITS,
        remaining: FREE_PLAN_LIMITS,
      } satisfies TLimitsResponseSchema;
    });
};
