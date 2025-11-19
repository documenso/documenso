import { trpcServer } from '@hono/trpc-server';

import { createTrpcContext } from '@doku-seal/trpc/server/context';
import { appRouter } from '@doku-seal/trpc/server/router';
import { handleTrpcRouterError } from '@doku-seal/trpc/utils/trpc-error-handler';

/**
 * Trpc server for internal routes like /api/trpc/*
 */
export const reactRouterTrpcServer = trpcServer({
  router: appRouter,
  endpoint: '/api/trpc',
  createContext: async (_, c) => createTrpcContext({ c, requestSource: 'app' }),
  onError: (opts) => handleTrpcRouterError(opts, 'trpc'),
});
