'use client';

import { useState } from 'react';

<<<<<<< HEAD
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
=======
import type { QueryClientConfig } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, httpLink, splitLink } from '@trpc/client';
>>>>>>> main
import { createTRPCReact } from '@trpc/react-query';
import SuperJSON from 'superjson';

import { getBaseUrl } from '@documenso/lib/universal/get-base-url';

<<<<<<< HEAD
import { AppRouter } from '../server/router';

export const trpc = createTRPCReact<AppRouter>({
  unstable_overrides: {
    useMutation: {
      async onSuccess(opts) {
        await opts.originalFn();
        await opts.queryClient.invalidateQueries();
=======
import type { AppRouter } from '../server/router';

export { getQueryKey } from '@trpc/react-query';

export const trpc = createTRPCReact<AppRouter>({
  overrides: {
    useMutation: {
      async onSuccess(opts) {
        await opts.originalFn();

        if (opts.meta.doNotInvalidateQueryOnMutation) {
          return;
        }

        // Invalidate all queries besides ones that specify not to in the meta data.
        await opts.queryClient.invalidateQueries({
          predicate: (query) => !query?.meta?.doNotInvalidateQueryOnMutation,
        });
>>>>>>> main
      },
    },
  },
});

export interface TrpcProviderProps {
  children: React.ReactNode;
}

export function TrpcProvider({ children }: TrpcProviderProps) {
<<<<<<< HEAD
  const [queryClient] = useState(() => new QueryClient());
=======
  let queryClientConfig: QueryClientConfig | undefined;

  const isDevelopingOffline =
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost' &&
    !window.navigator.onLine;

  if (isDevelopingOffline) {
    queryClientConfig = {
      defaultOptions: {
        queries: {
          networkMode: 'always',
        },
        mutations: {
          networkMode: 'always',
        },
      },
    };
  }

  const [queryClient] = useState(() => new QueryClient(queryClientConfig));
>>>>>>> main

  const [trpcClient] = useState(() =>
    trpc.createClient({
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
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
