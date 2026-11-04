import { findPasskeys } from '@documenso/lib/server-only/auth/find-passkeys';

import { authenticatedProcedure } from '../trpc';
import { twoFactorInstanceOnly } from '../two-factor-enforcement/enforce';
import { ZFindPasskeysRequestSchema, ZFindPasskeysResponseSchema } from './find-passkeys.types';

export const findPasskeysRoute = authenticatedProcedure
  .meta({ allowEmbedSession: true })
  .input(ZFindPasskeysRequestSchema)
  .output(ZFindPasskeysResponseSchema)
  .use(twoFactorInstanceOnly())
  .query(async ({ input, ctx }) => {
    const { page, perPage, orderBy } = input;

    return await findPasskeys({
      page,
      perPage,
      orderBy,
      userId: ctx.user.id,
    });
  });
