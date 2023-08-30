import * as trpcNext from '@documenso/trpc/server/adapters/next';
import { createTrpcContext } from '@documenso/trpc/server/context';
import { appRouter } from '@documenso/trpc/server/router';

export default trpcNext.createNextApiHandler({
  router: appRouter,
  createContext: async ({ req, res }) => createTrpcContext({ req, res }),
});

// export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
//   res.json({ hello: 'world' });
// }
