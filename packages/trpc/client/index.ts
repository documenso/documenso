<<<<<<< HEAD
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
=======
import { createTRPCProxyClient, httpBatchLink, httpLink, splitLink } from '@trpc/client';
>>>>>>> main
import SuperJSON from 'superjson';

import { getBaseUrl } from '@documenso/lib/universal/get-base-url';

<<<<<<< HEAD
import { AppRouter } from '../server/router';
=======
import type { AppRouter } from '../server/router';
>>>>>>> main

export const trpc = createTRPCProxyClient<AppRouter>({
  transformer: SuperJSON,

  links: [
<<<<<<< HEAD
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
=======
    splitLink({
      condition: (op) => op.context.skipBatch === true,
      true: httpLink({
        url: `${getBaseUrl()}/api/trpc`,
      }),
      false: httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
      }),
>>>>>>> main
    }),
  ],
});

export { TRPCClientError } from '@trpc/client';
