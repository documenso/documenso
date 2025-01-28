import { createOpenApiNextHandler } from 'trpc-to-openapi';

import {
  AppError,
  AppErrorCode,
  genericErrorCodeToTrpcErrorCodeMap,
} from '@documenso/lib/errors/app-error';
import { buildLogger } from '@documenso/lib/utils/logger';
import { createTrpcContext } from '@documenso/trpc/server/context';
import { appRouter } from '@documenso/trpc/server/router';

const logger = buildLogger();

export default createOpenApiNextHandler<typeof appRouter>({
  router: appRouter,
  createContext: async ({ req, res }) => createTrpcContext({ req, res, requestSource: 'apiV2' }),
  onError: ({ error, path }) => {
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
  // Not sure why we need to do this since we handle it in errorFormatter which runs after this.
  responseMeta: (opts) => {
    if (opts.errors[0]?.cause instanceof AppError) {
      const appError = AppError.parseError(opts.errors[0].cause);

      const httpStatus = genericErrorCodeToTrpcErrorCodeMap[appError.code]?.status ?? 400;

      return {
        status: httpStatus,
      };
    }

    return {};
  },
});

const errorCodesToAlertOn = [AppErrorCode.UNKNOWN_ERROR, 'INTERNAL_SERVER_ERROR'];
