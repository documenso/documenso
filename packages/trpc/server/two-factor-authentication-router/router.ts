import { TRPCError } from '@trpc/server';

import { AppError } from '@documenso/lib/errors/app-error';
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
    try {
      return await setupTwoFactorAuthentication({
        user: ctx.user,
      });
    } catch (err) {
      console.error(err);

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to setup two-factor authentication. Please try again later.',
      });
    }
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
        const error = AppError.parseError(err);

        if (error.code !== 'INCORRECT_TWO_FACTOR_CODE') {
          console.error(err);
        }

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

        return await disableTwoFactorAuthentication({
          user,
          token: input.token,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        const error = AppError.parseError(err);

        if (error.code !== 'INCORRECT_TWO_FACTOR_CODE') {
          console.error(err);
        }

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
        return await viewBackupCodes({
          user: ctx.user,
          token: input.token,
        });
      } catch (err) {
        const error = AppError.parseError(err);

        if (error.code !== 'INCORRECT_TWO_FACTOR_CODE') {
          console.error(err);
        }

        throw AppError.parseErrorToTRPCError(err);
      }
    }),
});
