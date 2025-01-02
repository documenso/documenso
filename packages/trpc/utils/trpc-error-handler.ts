import type { ErrorHandlerOptions } from '@trpc/server/unstable-core-do-not-import';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildLogger } from '@documenso/lib/utils/logger';

const logger = buildLogger();

// Parameters<NonNullable<Parameters<typeof trpcServer>[0]['onError']>>[0], // :-)
export const handleTrpcRouterError = (
  { error, path }: Pick<ErrorHandlerOptions<undefined>, 'error' | 'path'>,
  source: 'trpc' | 'apiV1' | 'apiV2',
) => {
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
    console.error(error);

    logger.error(error, {
      method: path,
      context: {
        source,
        appError: AppError.toJSON(appError),
      },
    });
  }
};

const errorCodesToAlertOn = [AppErrorCode.UNKNOWN_ERROR, 'INTERNAL_SERVER_ERROR'];
