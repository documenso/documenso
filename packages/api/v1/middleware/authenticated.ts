import type { NextApiRequest } from 'next';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getApiTokenByToken } from '@documenso/lib/server-only/public-api/get-api-token-by-token';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
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
  handler: (
    args: T,
    user: User,
    team: Team | null | undefined,
    options: { metadata: ApiRequestMetadata },
  ) => Promise<R>,
) => {
  return async (args: T) => {
    try {
      const { authorization } = args.req.headers;

      // Support for both "Authorization: Bearer api_xxx" and "Authorization: api_xxx"
      const [token] = (authorization || '').split('Bearer ').filter((s) => s.length > 0);

      if (!token) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'API token was not provided',
        });
      }

      const apiToken = await getApiTokenByToken({ token });

      if (apiToken.user.disabled) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'User is disabled',
        });
      }

      const metadata: ApiRequestMetadata = {
        requestMetadata: extractNextApiRequestMetadata(args.req),
        source: 'apiV1',
        auth: 'api',
        auditUser: {
          id: apiToken.team ? null : apiToken.user.id,
          email: apiToken.team ? null : apiToken.user.email,
          name: apiToken.team?.name ?? apiToken.user.name,
        },
      };

      return await handler(args, apiToken.user, apiToken.team, { metadata });
    } catch (err) {
      console.log({ err: err });

      let message = 'Unauthorized';

      if (err instanceof AppError) {
        message = err.message;
      }

      return {
        status: 401,
        body: {
          message,
        },
      } as const;
    }
  };
};
