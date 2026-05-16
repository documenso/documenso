import { getBasePath } from '@documenso/lib/constants/app';
import { createTrpcContext } from '@documenso/trpc/server/context';
import { appRouter } from '@documenso/trpc/server/router';
import { handleTrpcRouterError } from '@documenso/trpc/utils/trpc-error-handler';
import { trpcServer } from '@hono/trpc-server';

/**
 * Trpc server for internal routes like /api/trpc/*
 *
 * `endpoint` must include the sub-path prefix (e.g. "/ESign") because the
 * @hono/trpc-server adapter slices the prefix off the full URL pathname to
 * compute the procedure name. Hono's `basePath` doesn't rewrite the URL.
 */
export const reactRouterTrpcServer = trpcServer({
  router: appRouter,
  endpoint: `${getBasePath()}/api/trpc`,
  createContext: async (_, c) => createTrpcContext({ c, requestSource: 'app' }),
  onError: (opts) => handleTrpcRouterError(opts, 'trpc'),
});
