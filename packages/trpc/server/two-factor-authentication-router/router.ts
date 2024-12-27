import { disableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/disable-2fa';
import { enableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/enable-2fa';
import { setupTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/setup-2fa';
import { viewBackupCodes } from '@documenso/lib/server-only/2fa/view-backup-codes';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZDisableTwoFactorAuthenticationMutationSchema,
  ZEnableTwoFactorAuthenticationMutationSchema,
  ZViewRecoveryCodesMutationSchema,
} from './schema';

export const twoFactorAuthenticationRouter = router({
  setup: authenticatedProcedure.mutation(async ({ ctx }) => {
    return await setupTwoFactorAuthentication({
      user: ctx.user,
    });
  }),

  enable: authenticatedProcedure
    .input(ZEnableTwoFactorAuthenticationMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;

      const { code } = input;

      return await enableTwoFactorAuthentication({
        user,
        code,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  disable: authenticatedProcedure
    .input(ZDisableTwoFactorAuthenticationMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;

      return await disableTwoFactorAuthentication({
        user,
        totpCode: input.totpCode,
        backupCode: input.backupCode,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    }),

  viewRecoveryCodes: authenticatedProcedure
    .input(ZViewRecoveryCodesMutationSchema)
    .mutation(async ({ ctx, input }) => {
      return await viewBackupCodes({
        user: ctx.user,
        token: input.token,
      });
    }),
});
