import { TRPCError } from '@trpc/server';

import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getSubscriptionsByUserId } from '@documenso/lib/server-only/subscription/get-subscriptions-by-user-id';
import { deleteUser } from '@documenso/lib/server-only/user/delete-user';
import { findUserSecurityAuditLogs } from '@documenso/lib/server-only/user/find-user-security-audit-logs';
import { forgotPassword } from '@documenso/lib/server-only/user/forgot-password';
import { getUserById } from '@documenso/lib/server-only/user/get-user-by-id';
import { resetPassword } from '@documenso/lib/server-only/user/reset-password';
import { sendConfirmationToken } from '@documenso/lib/server-only/user/send-confirmation-token';
import { updatePassword } from '@documenso/lib/server-only/user/update-password';
import { updateProfile } from '@documenso/lib/server-only/user/update-profile';
import { updatePublicProfile } from '@documenso/lib/server-only/user/update-public-profile';
import { extractNextApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { SubscriptionStatus } from '@documenso/prisma/client';

import { adminProcedure, authenticatedProcedure, procedure, router } from '../trpc';
import {
  ZConfirmEmailMutationSchema,
  ZFindUserSecurityAuditLogsSchema,
  ZForgotPasswordFormSchema,
  ZResetPasswordFormSchema,
  ZRetrieveUserByIdQuerySchema,
  ZUpdatePasswordMutationSchema,
  ZUpdateProfileMutationSchema,
  ZUpdatePublicProfileMutationSchema,
} from './schema';

export const profileRouter = router({
  findUserSecurityAuditLogs: authenticatedProcedure
    .input(ZFindUserSecurityAuditLogsSchema)
    .query(async ({ input, ctx }) => {
      try {
        return await findUserSecurityAuditLogs({
          userId: ctx.user.id,
          ...input,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'We were unable to find user security audit logs. Please try again.',
        });
      }
    }),

  getUser: adminProcedure.input(ZRetrieveUserByIdQuerySchema).query(async ({ input }) => {
    try {
      const { id } = input;

      return await getUserById({ id });
    } catch (err) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'We were unable to retrieve the specified account. Please try again.',
      });
    }
  }),

  updateProfile: authenticatedProcedure
    .input(ZUpdateProfileMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { name, signature } = input;

        return await updateProfile({
          userId: ctx.user.id,
          name,
          signature,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        console.error(err);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'We were unable to update your profile. Please review the information you provided and try again.',
        });
      }
    }),

  updatePublicProfile: authenticatedProcedure
    .input(ZUpdatePublicProfileMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { url } = input;

        if (IS_BILLING_ENABLED() && url.length <= 6) {
          const subscriptions = await getSubscriptionsByUserId({
            userId: ctx.user.id,
          }).then((subscriptions) =>
            subscriptions.filter((s) => s.status === SubscriptionStatus.ACTIVE),
          );

          if (subscriptions.length === 0) {
            throw new AppError(
              AppErrorCode.PREMIUM_PROFILE_URL,
              'Only subscribers can have a username shorter than 6 characters',
            );
          }
        }

        const user = await updatePublicProfile({
          userId: ctx.user.id,
          url,
        });

        return { success: true, url: user.url };
      } catch (err) {
        const error = AppError.parseError(err);

        if (error.code !== AppErrorCode.UNKNOWN_ERROR) {
          throw AppError.parseErrorToTRPCError(error);
        }

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'We were unable to update your public profile. Please review the information you provided and try again.',
        });
      }
    }),

  updatePassword: authenticatedProcedure
    .input(ZUpdatePasswordMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { password, currentPassword } = input;

        return await updatePassword({
          userId: ctx.user.id,
          password,
          currentPassword,
          requestMetadata: extractNextApiRequestMetadata(ctx.req),
        });
      } catch (err) {
        let message =
          'We were unable to update your profile. Please review the information you provided and try again.';

        if (err instanceof Error) {
          message = err.message;
        }

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message,
        });
      }
    }),

  forgotPassword: procedure.input(ZForgotPasswordFormSchema).mutation(async ({ input }) => {
    try {
      const { email } = input;

      return await forgotPassword({
        email,
      });
    } catch (err) {
      console.error(err);
    }
  }),

  resetPassword: procedure.input(ZResetPasswordFormSchema).mutation(async ({ input, ctx }) => {
    try {
      const { password, token } = input;

      return await resetPassword({
        token,
        password,
        requestMetadata: extractNextApiRequestMetadata(ctx.req),
      });
    } catch (err) {
      let message = 'We were unable to reset your password. Please try again.';

      if (err instanceof Error) {
        message = err.message;
      }

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message,
      });
    }
  }),

  sendConfirmationEmail: procedure
    .input(ZConfirmEmailMutationSchema)
    .mutation(async ({ input }) => {
      try {
        const { email } = input;

        return await sendConfirmationToken({ email });
      } catch (err) {
        let message = 'We were unable to send a confirmation email. Please try again.';

        if (err instanceof Error) {
          message = err.message;
        }

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message,
        });
      }
    }),

  deleteAccount: authenticatedProcedure.mutation(async ({ ctx }) => {
    try {
      return await deleteUser({
        id: ctx.user.id,
      });
    } catch (err) {
      let message = 'We were unable to delete your account. Please try again.';

      if (err instanceof Error) {
        message = err.message;
      }

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message,
      });
    }
  }),
});
