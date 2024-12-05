import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildLogger } from '@documenso/lib/utils/logger';
import * as trpcNext from '@documenso/trpc/server/adapters/next';
import { createTrpcContext } from '@documenso/trpc/server/context';
import { appRouter } from '@documenso/trpc/server/router';

export const config = {
  maxDuration: 120,
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

const logger = buildLogger();

export default trpcNext.createNextApiHandler({
  router: appRouter,
  createContext: async ({ req, res }) => createTrpcContext({ req, res }),
  onError(opts) {
    const { error, path } = opts;

    // Currently trialing changes with template and team router only.
    if (!path || (!path.startsWith('template') && !path.startsWith('team'))) {
      return;
    }

    // Always log the error for now.
    console.error(error);

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
          appError: AppError.toJSON(appError),
        },
      });
    }
  },
});

const errorCodesToAlertOn = [AppErrorCode.UNKNOWN_ERROR, 'INTERNAL_SERVER_ERROR'];
