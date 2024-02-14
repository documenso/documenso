import type { NextApiRequest, NextApiResponse } from 'next';

import { getToken } from 'next-auth/jwt';
import { match } from 'ts-pattern';

import { ERROR_CODES } from './errors';
import type { TLimitsErrorResponseSchema, TLimitsResponseSchema } from './schema';
import { getServerLimits } from './server';

export const limitsHandler = async (
  req: NextApiRequest,
  res: NextApiResponse<TLimitsResponseSchema | TLimitsErrorResponseSchema>,
) => {
  try {
    const token = await getToken({ req });

    const rawTeamId = req.headers['team-id'];

    let teamId: number | null = null;

    if (typeof rawTeamId === 'string' && !isNaN(parseInt(rawTeamId, 10))) {
      teamId = parseInt(rawTeamId, 10);
    }

    if (!teamId && rawTeamId) {
      throw new Error(ERROR_CODES.INVALID_TEAM_ID);
    }

    const limits = await getServerLimits({ email: token?.email, teamId });

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
