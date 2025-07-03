import type { Team, User } from '@prisma/client';
import type { TsRestRequest } from '@ts-rest/serverless';
import type { Logger } from 'pino';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getApiTokenByToken } from '@documenso/lib/server-only/public-api/get-api-token-by-token';
import type { BaseApiLog, RootApiLog } from '@documenso/lib/types/api-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { nanoid } from '@documenso/lib/universal/id';
import { logger } from '@documenso/lib/utils/logger';

type B = {
  // appRoute: any;
  request: TsRestRequest;
  responseHeaders: Headers;
};

export const authenticatedMiddleware = <
  T extends {
    headers: {
      authorization: string;
    };
  },
  R extends {
    status: number;
    body: unknown;
  },
>(
  handler: (
    args: T & { req: TsRestRequest },
    user: Pick<User, 'id' | 'email' | 'name' | 'disabled'>,
    team: Team,
    options: { metadata: ApiRequestMetadata; logger: Logger },
  ) => Promise<R>,
) => {
  return async (args: T, { request }: B) => {
    const requestMetadata = extractRequestMetadata(request);

    const apiLogger = logger.child({
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      requestId: nanoid(),
    } satisfies RootApiLog);

    const infoToLog: BaseApiLog = {
      auth: 'api',
      source: 'apiV1',
      path: request.url,
    };

    try {
      const { authorization } = args.headers;

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

      apiLogger.info({
        ...infoToLog,
        userId: apiToken.user.id,
        apiTokenId: apiToken.id,
      } satisfies BaseApiLog);

      const metadata: ApiRequestMetadata = {
        requestMetadata,
        source: 'apiV1',
        auth: 'api',
        auditUser: {
          id: apiToken.team ? null : apiToken.user.id,
          email: apiToken.team ? null : apiToken.user.email,
          name: apiToken.team?.name ?? apiToken.user.name,
        },
      };

      return await handler(
        {
          ...args,
          req: request,
        },
        apiToken.user,
        apiToken.team,
        { metadata, logger: apiLogger },
      );
    } catch (err) {
      console.log({ err });

      apiLogger.info(infoToLog);

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
