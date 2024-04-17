import * as trpcNext from '@documenso/trpc/server/adapters/next';
import { createTrpcContext } from '@documenso/trpc/server/context';
import { appRouter } from '@documenso/trpc/server/router';

<<<<<<< HEAD
=======
export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

>>>>>>> main
export default trpcNext.createNextApiHandler({
  router: appRouter,
  createContext: async ({ req, res }) => createTrpcContext({ req, res }),
});
