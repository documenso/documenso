import { NextApiRequest, NextApiResponse } from 'next';

import { getToken } from 'next-auth/jwt';
import { match } from 'ts-pattern';

import { ERROR_CODES } from './errors';
import { TLimitsErrorResponseSchema, TLimitsResponseSchema } from './schema';
import { getServerLimits } from './server';

export const limitsHandler = async (
  req: NextApiRequest,
  res: NextApiResponse<TLimitsResponseSchema | TLimitsErrorResponseSchema>,
) => {
  try {
    const token = await getToken({ req });

    const limits = await getServerLimits({ email: token?.email });

    return res.status(200).json(limits);
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

    return res.status(500).json({
      error: ERROR_CODES.UNKNOWN,
    });
  }
};
