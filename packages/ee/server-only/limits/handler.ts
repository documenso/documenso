import { match } from 'ts-pattern';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';

import { ERROR_CODES } from './errors';
import { getServerLimits } from './server';

export const limitsHandler = async (req: Request) => {
  try {
    const { user } = await getSession(req);

    const rawTeamId = req.headers.get('team-id');

    let teamId: number | null = null;

    if (typeof rawTeamId === 'string' && !isNaN(parseInt(rawTeamId, 10))) {
      teamId = parseInt(rawTeamId, 10);
    }

    if (!teamId) {
      throw new Error(ERROR_CODES.INVALID_TEAM_ID);
    }

    const limits = await getServerLimits({ userId: user.id, teamId });

    return Response.json(limits, {
      status: 200,
    });
  } catch (err) {
    console.error('error', err);

    if (err instanceof Error) {
      const status = match(err.message)
        .with(ERROR_CODES.UNAUTHORIZED, () => 401)
        .otherwise(() => 500);

      return Response.json(
        {
          error: ERROR_CODES[err.message] ?? ERROR_CODES.UNKNOWN,
        },
        {
          status,
        },
      );
    }

    return Response.json(
      {
        error: ERROR_CODES.UNKNOWN,
      },
      {
        status: 500,
      },
    );
  }
};
