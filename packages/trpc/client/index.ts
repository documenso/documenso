import { createTRPCClient, httpBatchLink, httpLink, splitLink } from '@trpc/client';
import SuperJSON from 'superjson';

import { getBaseUrl } from '@documenso/lib/universal/get-base-url';

import type { AppRouter } from '../server/router';

export const trpc = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.context.skipBatch === true,
      true: httpLink({
        url: `${getBaseUrl()}/api/trpc`,
        transformer: SuperJSON,
        headers: (opts) => {
          if (typeof opts.op.context.teamId === 'string') {
            return {
              'x-team-id': opts.op.context.teamId,
            };
          }

          return {};
        },
      }),
      false: httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        transformer: SuperJSON,
        headers: (opts) => {
          const operationWithTeamId = opts.opList.find(
            (op) => op.context.teamId && typeof op.context.teamId === 'string',
          );

          if (operationWithTeamId && typeof operationWithTeamId.context.teamId === 'string') {
            return {
              'x-team-id': operationWithTeamId.context.teamId,
            };
          }

          return {};
        },
      }),
    }),
  ],
});
