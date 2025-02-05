import { trpcServer } from '@hono/trpc-server';

import { createTrpcContext } from '@documenso/trpc/server/context';
import { appRouter } from '@documenso/trpc/server/router';
import { handleTrpcRouterError } from '@documenso/trpc/utils/trpc-error-handler';

// Todo
// export const config = {
//   maxDuration: 120,
//   api: {
//     bodyParser: {
//       sizeLimit: '50mb',
//     },
//   },
// };

/**
 * Trpc server for internal routes like /api/trpc/*
 */
export const reactRouterTrpcServer = trpcServer({
  router: appRouter,
  endpoint: '/api/trpc',
  createContext: async (_, c) => createTrpcContext({ c, requestSource: 'app' }),
  onError: (opts) => handleTrpcRouterError(opts, 'trpc'),
});
