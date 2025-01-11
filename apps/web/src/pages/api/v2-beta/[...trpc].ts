import type { NextApiRequest, NextApiResponse } from 'next';

import { createOpenApiNextHandler } from 'trpc-openapi';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildLogger } from '@documenso/lib/utils/logger';
import type { TRPCError } from '@documenso/trpc/server';
import { createTrpcContext } from '@documenso/trpc/server/context';
import { appRouter } from '@documenso/trpc/server/router';

const logger = buildLogger();

export default createOpenApiNextHandler<typeof appRouter>({
  router: appRouter,
  createContext: async ({ req, res }: { req: NextApiRequest; res: NextApiResponse }) =>
    createTrpcContext({ req, res, requestSource: 'apiV2' }),
  onError: ({ error, path }: { error: TRPCError; path?: string }) => {
    // Always log the error for now.
    console.error(error.message);

    const appError = AppError.parseError(error.cause || error);

    const isAppError = error.cause instanceof AppError;

    // Only log AppErrors that are explicitly set to 500 or the error code
    // is in the errorCodesToAlertOn list.
    const isLoggableAppError =
      isAppError && (appError.statusCode === 500 || errorCodesToAlertOn.includes(appError.code));

    // Only log TRPC errors that are in the `errorCodesToAlertOn` list and is
    // not an AppError.
    const isLoggableTrpcError = !isAppError && errorCodesToAlertOn.includes(error.code);

    if (isLoggableAppError || isLoggableTrpcError) {
      logger.error(error, {
        method: path,
        context: {
          source: '/v2/api',
          appError: AppError.toJSON(appError),
        },
      });
    }
  },
  responseMeta: () => {},
});

const errorCodesToAlertOn = [AppErrorCode.UNKNOWN_ERROR, 'INTERNAL_SERVER_ERROR'];
