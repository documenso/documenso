import { findPasskeys } from '@doku-seal/lib/server-only/auth/find-passkeys';

import { authenticatedProcedure } from '../trpc';
import { ZFindPasskeysRequestSchema, ZFindPasskeysResponseSchema } from './find-passkeys.types';

export const findPasskeysRoute = authenticatedProcedure
  .input(ZFindPasskeysRequestSchema)
  .output(ZFindPasskeysResponseSchema)
  .query(async ({ input, ctx }) => {
    const { page, perPage, orderBy } = input;

    return await findPasskeys({
      page,
      perPage,
      orderBy,
      userId: ctx.user.id,
    });
  });
