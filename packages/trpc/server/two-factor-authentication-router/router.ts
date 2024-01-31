import { TRPCError } from '@trpc/server';

import { ErrorCode } from '@documenso/lib/next-auth/error-codes';
import { disableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/disable-2fa';
import { enableTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/enable-2fa';
import { getBackupCodes } from '@documenso/lib/server-only/2fa/get-backup-code';
import { setupTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/setup-2fa';
import { compareSync } from '@documenso/lib/server-only/auth/hash';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZDisableTwoFactorAuthenticationMutationSchema,
  ZEnableTwoFactorAuthenticationMutationSchema,
  ZSetupTwoFactorAuthenticationMutationSchema,
  ZViewRecoveryCodesMutationSchema,
} from './schema';

export const twoFactorAuthenticationRouter = router({
  setup: authenticatedProcedure
    .input(ZSetupTwoFactorAuthenticationMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;

      const { password } = input;

      return await setupTwoFactorAuthentication({
        user,
        password,
      });
    }),

  enable: authenticatedProcedure
    .input(ZEnableTwoFactorAuthenticationMutationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const user = ctx.user;

        const { code } = input;

        return await enableTwoFactorAuthentication({
          user,
          code,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to enable two-factor authentication. Please try again later.',
        });
      }
    }),

  disable: authenticatedProcedure
    .input(ZDisableTwoFactorAuthenticationMutationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const user = ctx.user;

        const { password, backupCode } = input;

        return await disableTwoFactorAuthentication({
          user,
          password,
          backupCode,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to disable two-factor authentication. Please try again later.',
        });
      }
    }),

  viewRecoveryCodes: authenticatedProcedure
    .input(ZViewRecoveryCodesMutationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const user = ctx.user;

        const { password } = input;

        if (!user.twoFactorEnabled) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: ErrorCode.TWO_FACTOR_SETUP_REQUIRED,
          });
        }

        if (!user.password || !compareSync(password, user.password)) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ErrorCode.INCORRECT_PASSWORD,
          });
        }

        const recoveryCodes = await getBackupCodes({ user });

        return { recoveryCodes };
      } catch (err) {
        console.error(err);

        if (err instanceof TRPCError) {
          throw err;
        }

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to view your recovery codes. Please try again later.',
        });
      }
    }),
});
