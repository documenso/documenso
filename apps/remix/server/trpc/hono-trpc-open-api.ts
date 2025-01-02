import type { Context } from 'hono';
import { createOpenApiFetchHandler } from 'trpc-to-openapi';

import { API_V2_BETA_URL } from '@documenso/lib/constants/app';
import { AppError, genericErrorCodeToTrpcErrorCodeMap } from '@documenso/lib/errors/app-error';
import { createTrpcContext } from '@documenso/trpc/server/context';
import { appRouter } from '@documenso/trpc/server/router';
import { handleTrpcRouterError } from '@documenso/trpc/utils/trpc-error-handler';

export const openApiTrpcServerHandler = async (c: Context) => {
  return createOpenApiFetchHandler<typeof appRouter>({
    endpoint: API_V2_BETA_URL,
    router: appRouter,
    createContext: async () => createTrpcContext({ c, requestSource: 'apiV2' }),
    req: c.req.raw,
    onError: (opts) => handleTrpcRouterError(opts, 'apiV2'),
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
};
