import { useMemo, useState } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, httpLink, isNonJsonSerializable, splitLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';

import { getBaseUrl } from '@documenso/lib/universal/get-base-url';

import type { AppRouter } from '../server/router';
import { dataTransformer } from '../utils/data-transformer';

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
  headers?: Record<string, string>;
}

export function TrpcProvider({ children, headers }: TrpcProviderProps) {
  const [queryClient] = useState(() => new QueryClient());

  // May cause remounting issues.
  const trpcClient = useMemo(
    () =>
      trpc.createClient({
        links: [
          splitLink({
            condition: (op) => op.context.skipBatch === true || isNonJsonSerializable(op.input),
            true: httpLink({
              url: `${getBaseUrl()}/api/trpc`,
              headers,
              transformer: dataTransformer,
            }),
            false: httpBatchLink({
              url: `${getBaseUrl()}/api/trpc`,
              headers,
              transformer: dataTransformer,
            }),
          }),
        ],
      }),
    [headers],
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
