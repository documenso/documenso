import { APP_BASE_URL } from '@documenso/lib/constants/app';

import { FREE_PLAN_LIMITS } from './constants';
<<<<<<< HEAD
import { TLimitsResponseSchema, ZLimitsResponseSchema } from './schema';

export type GetLimitsOptions = {
  headers?: Record<string, string>;
};

export const getLimits = async ({ headers }: GetLimitsOptions = {}) => {
  const requestHeaders = headers ?? {};

  const url = new URL(`${APP_BASE_URL}/api/limits`);
=======
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
>>>>>>> main

  return fetch(url, {
    headers: {
      ...requestHeaders,
    },
<<<<<<< HEAD
    next: {
      revalidate: 60,
    },
  })
    .then(async (res) => res.json())
    .then((res) => ZLimitsResponseSchema.parse(res))
    .catch(() => {
=======
  })
    .then(async (res) => res.json())
    .then((res) => ZLimitsResponseSchema.parse(res))
    .catch((_err) => {
>>>>>>> main
      return {
        quota: FREE_PLAN_LIMITS,
        remaining: FREE_PLAN_LIMITS,
      } satisfies TLimitsResponseSchema;
    });
};
