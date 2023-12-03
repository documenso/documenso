import { TRPCError } from '@trpc/server';

import { ErrorCode } from '@documenso/lib/next-auth/error-codes';
import { disableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/disable-2fa';
import { enableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/enable-2fa';
import { getBackupCodes } from '@documenso/lib/server-only/2fa/get-backup-code';
import { setupTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/setup-2fa';
import { compareSync } from '@documenso/lib/server-only/auth/hash';
import { disableSemSearch } from '@documenso/lib/server-only/sem-search/disable-sem-search';
import { enableSemSearch } from '@documenso/lib/server-only/sem-search/enable-sem-search';

import { authenticatedProcedure, router } from '../trpc';

export const semSearchRouter = router({
  enable: authenticatedProcedure.mutation(async ({ ctx }) => {
    try {
      const user = ctx.user;

      return await enableSemSearch(user);
    } catch (err) {
      console.error(err);

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to enable semantic search. Please try again later.',
      });
    }
  }),

  disable: authenticatedProcedure.mutation(async ({ ctx }) => {
    try {
      const user = ctx.user;

      return await disableSemSearch(user);
    } catch (err) {
      console.error(err);

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to disable semantic search. Please try again later.',
      });
    }
  }),
});
