import type { ErrorHandlerOptions } from '@trpc/server/unstable-core-do-not-import';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { logger } from '@documenso/lib/utils/logger';

import type { TrpcContext } from '../server/context';

// Parameters<NonNullable<Parameters<typeof trpcServer>[0]['onError']>>[0], // :-)
export const handleTrpcRouterError = (
  { error, ctx }: Pick<ErrorHandlerOptions<TrpcContext>, 'error' | 'path' | 'ctx'>,
  _source: 'trpc' | 'apiV1' | 'apiV2',
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

  const errorLogger = (ctx?.logger || logger).child({
    status: 'error',
    appError: AppError.toJSON(appError),
  });

  // Only fully log the error on certain conditions since some errors are expected.
  if (isLoggableAppError || isLoggableTrpcError) {
    errorLogger.error(error);
  } else {
    errorLogger.info('TRPC_ERROR_HANDLER');
  }
};

const errorCodesToAlertOn = [AppErrorCode.UNKNOWN_ERROR, 'INTERNAL_SERVER_ERROR'];
