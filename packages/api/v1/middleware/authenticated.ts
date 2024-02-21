import type { NextApiRequest } from 'next';

import { getUserByApiToken } from '@documenso/lib/server-only/public-api/get-user-by-token';
import type { User } from '@documenso/prisma/client';

export const authenticatedMiddleware = <
  T extends {
    req: NextApiRequest;
  },
  R extends {
    status: number;
    body: unknown;
  },
>(
  handler: (args: T, user: User) => Promise<R>,
) => {
  return async (args: T) => {
    try {
      const { authorization } = args.req.headers;

      // Support for both "Authorization: Bearer api_xxx" and "Authorization: api_xxx"
      const [token] = (authorization || '').split('Bearer ').filter((s) => s.length > 0);

      if (!token) {
        throw new Error('Token was not provided for authenticated middleware');
      }

      const user = await getUserByApiToken({ token });

      return await handler(args, user);
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
