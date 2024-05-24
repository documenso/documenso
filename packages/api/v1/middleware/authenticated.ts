import type { NextApiRequest } from 'next';

import { getApiTokenByToken } from '@documenso/lib/server-only/public-api/get-api-token-by-token';
import type { Team, User } from '@documenso/prisma/client';

export const authenticatedMiddleware = <
  T extends {
    req: NextApiRequest;
  },
  R extends {
    status: number;
    body: unknown;
  },
>(
  handler: (args: T, user: User, team?: Team | null) => Promise<R>,
) => {
  return async (args: T) => {
    try {
      const { authorization } = args.req.headers;

      // Support for both "Authorization: Bearer api_xxx" and "Authorization: api_xxx"
      const [token] = (authorization || '').split('Bearer ').filter((s) => s.length > 0);

      if (!token) {
        throw new Error('Token was not provided for authenticated middleware');
      }

      const apiToken = await getApiTokenByToken({ token });

      return await handler(args, apiToken.user, apiToken.team);
    } catch (_err) {
      console.log({ _err });
      return {
        status: 401,
        body: {
          message: 'Unauthorized',
        },
      } as const;
    }
  };
};
