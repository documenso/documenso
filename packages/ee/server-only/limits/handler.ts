import { NextApiRequest, NextApiResponse } from 'next';

import { getToken } from 'next-auth/jwt';
import { match } from 'ts-pattern';

import { withStaleWhileRevalidate } from '@documenso/lib/server-only/http/with-swr';
import { getFlag } from '@documenso/lib/universal/get-feature-flag';

import { SELFHOSTED_PLAN_LIMITS } from './constants';
import { ERROR_CODES } from './errors';
import { TLimitsErrorResponseSchema, TLimitsResponseSchema } from './schema';
import { getServerLimits } from './server';

export const limitsHandler = async (
  req: NextApiRequest,
  res: NextApiResponse<TLimitsResponseSchema | TLimitsErrorResponseSchema>,
) => {
  try {
    const token = await getToken({ req });

    const isBillingEnabled = await getFlag('app_billing');

    if (!isBillingEnabled) {
      return withStaleWhileRevalidate<typeof res>(res).status(200).json({
        quota: SELFHOSTED_PLAN_LIMITS,
        remaining: SELFHOSTED_PLAN_LIMITS,
      });
    }

    if (!token?.email) {
      throw new Error(ERROR_CODES.UNAUTHORIZED);
    }

    const limits = await getServerLimits({ email: token.email });

    return withStaleWhileRevalidate<typeof res>(res).status(200).json(limits);
  } catch (err) {
    console.error('error', err);

    if (err instanceof Error) {
      const status = match(err.message)
        .with(ERROR_CODES.UNAUTHORIZED, () => 401)
        .otherwise(() => 500);

      return res.status(status).json({
        error: ERROR_CODES[err.message] ?? ERROR_CODES.UNKNOWN,
      });
    }

    res.status(500).json({
      error: ERROR_CODES.UNKNOWN,
    });
  }
};
