'use client';

import { useState } from 'react';

import type { QueryClientConfig } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import SuperJSON from 'superjson';

import { IS_OFFLINE_DEVELOPMENT_ENABLED } from '@documenso/lib/constants/app';
import { getBaseUrl } from '@documenso/lib/universal/get-base-url';

import type { AppRouter } from '../server/router';

export const trpc = createTRPCReact<AppRouter>({
  unstable_overrides: {
    useMutation: {
      async onSuccess(opts) {
        await opts.originalFn();
        await opts.queryClient.invalidateQueries();
      },
    },
  },
});

export interface TrpcProviderProps {
  children: React.ReactNode;
}

export function TrpcProvider({ children }: TrpcProviderProps) {
  let queryClientConfig: QueryClientConfig | undefined;

  if (IS_OFFLINE_DEVELOPMENT_ENABLED()) {
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
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
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
