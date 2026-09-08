import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

import { DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT, FREE_PLAN_LIMITS } from './constants';
import type { TLimitsResponseSchema } from './schema';
import { ZLimitsResponseSchema } from './schema';

export type GetLimitsOptions = {
  headers?: Record<string, string>;
  teamId: number;
};

export const getLimits = async ({ headers, teamId }: GetLimitsOptions) => {
  const requestHeaders = headers ?? {};

  // Note: the path must be appended rather than passed as the `new URL()` path
  // argument, since a leading-slash path replaces the sub-path that
  // NEXT_PUBLIC_WEBAPP_URL may carry (e.g. https://host/ESign).
  const url = new URL(`${NEXT_PUBLIC_WEBAPP_URL()}/api/limits`);

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
        maximumEnvelopeItemCount: DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT,
      } satisfies TLimitsResponseSchema;
    });
};
