import { findPasskeys } from '@documenso/lib/server-only/auth/find-passkeys';

import { authenticatedProcedure } from '../trpc';
import { twoFactorInstanceOnly } from '../two-factor-enforcement/enforce';
import { ZFindPasskeysRequestSchema, ZFindPasskeysResponseSchema } from './find-passkeys.types';

export const findPasskeysRoute = authenticatedProcedure
  .input(ZFindPasskeysRequestSchema)
  .output(ZFindPasskeysResponseSchema)
  // 2FA enforcement: user-level passkey credential management; no organisation scope. Instance assert still applies.
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
