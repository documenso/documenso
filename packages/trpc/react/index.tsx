'use client';

import { useState } from 'react';

import type { QueryClientConfig } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, httpLink, splitLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import SuperJSON from 'superjson';

import { getBaseUrl } from '@documenso/lib/universal/get-base-url';

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
      },
    },
  },
});

export interface TrpcProviderProps {
  children: React.ReactNode;
}

export function TrpcProvider({ children }: TrpcProviderProps) {
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

  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: SuperJSON,

      links: [
        splitLink({
          condition: (op) => op.context.skipBatch === true,
          true: httpLink({
            url: `${getBaseUrl()}/api/trpc`,
          }),
          false: httpBatchLink({
            url: `${getBaseUrl()}/api/trpc`,
          }),
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
