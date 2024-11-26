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

    // Always console log the error for now.
    console.error(error);

    const appError = AppError.parseError(error.cause || error);

    // Only log uncaught 500 errors.
    if (appError.code === 'INTERNAL_SERVER_ERROR' || appError.code === AppErrorCode.UNKNOWN_ERROR) {
      logger.error(error, {
        method: path,
        context: {
          appError: AppError.toJSON(appError),
        },
      });
    }
  },
});
