import { getBaseUrl } from '@documenso/lib/universal/get-base-url';
import { createTRPCClient, httpBatchLink, httpLink, isNonJsonSerializable, splitLink } from '@trpc/client';
import { z } from 'zod';

import type { AppRouter } from '../server/router';
import { dataTransformer } from '../utils/data-transformer';

const ZTeamIdHeaderSchema = z.string().min(1);

export const trpc = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.context.skipBatch === true || isNonJsonSerializable(op.input),
      true: httpLink({
        url: `${getBaseUrl()}/api/trpc`,
        transformer: dataTransformer,
        headers: (opts) => {
          const teamId = ZTeamIdHeaderSchema.safeParse(opts.op.context.teamId);

          if (teamId.success) {
            return {
              'x-team-id': teamId.data,
            };
          }

          return {};
        },
      }),
      false: httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        transformer: dataTransformer,
        headers: (opts) => {
          for (const op of opts.opList) {
            const teamId = ZTeamIdHeaderSchema.safeParse(op.context.teamId);

            if (teamId.success) {
              return {
                'x-team-id': teamId.data,
              };
            }
          }

          return {};
        },
      }),
    }),
  ],
});
