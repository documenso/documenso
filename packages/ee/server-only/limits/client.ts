import { APP_BASE_URL } from '@documenso/lib/constants/app';

import { FREE_PLAN_LIMITS } from './constants';
import { TLimitsResponseSchema, ZLimitsResponseSchema } from './schema';

export type GetLimitsOptions = {
  headers?: Record<string, string>;
};

export const getLimits = async ({ headers }: GetLimitsOptions = {}) => {
  const requestHeaders = headers ?? {};

  const url = new URL(`${APP_BASE_URL}/api/limits`);

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
