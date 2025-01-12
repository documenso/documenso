import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobsClient } from '@documenso/lib/jobs/client';
import { setAvatarImage } from '@documenso/lib/server-only/profile/set-avatar-image';
import { getSubscriptionsByUserId } from '@documenso/lib/server-only/subscription/get-subscriptions-by-user-id';
import { deleteUser } from '@documenso/lib/server-only/user/delete-user';
import { findUserSecurityAuditLogs } from '@documenso/lib/server-only/user/find-user-security-audit-logs';
import { forgotPassword } from '@documenso/lib/server-only/user/forgot-password';
import { getUserById } from '@documenso/lib/server-only/user/get-user-by-id';
import { resetPassword } from '@documenso/lib/server-only/user/reset-password';
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
  ZSetProfileImageMutationSchema,
  ZUpdatePasswordMutationSchema,
  ZUpdateProfileMutationSchema,
  ZUpdatePublicProfileMutationSchema,
} from './schema';

export const profileRouter = router({
  findUserSecurityAuditLogs: authenticatedProcedure
    .input(ZFindUserSecurityAuditLogsSchema)
    .query(async ({ input, ctx }) => {
      return await findUserSecurityAuditLogs({
        userId: ctx.user.id,
        ...input,
      });
    }),

  getUser: adminProcedure.input(ZRetrieveUserByIdQuerySchema).query(async ({ input }) => {
    const { id } = input;

    return await getUserById({ id });
  }),

  updateProfile: authenticatedProcedure
    .input(ZUpdateProfileMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { name, signature } = input;

      return await updateProfile({
        userId: ctx.user.id,
        name,
        signature,
        requestMetadata: ctx.metadata.requestMetadata,
      });
    }),

  updatePublicProfile: authenticatedProcedure
    .input(ZUpdatePublicProfileMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { url, bio, enabled } = input;

      if (IS_BILLING_ENABLED() && url !== undefined && url.length < 6) {
        const subscriptions = await getSubscriptionsByUserId({
          userId: ctx.user.id,
        }).then((subscriptions) =>
          subscriptions.filter((s) => s.status === SubscriptionStatus.ACTIVE),
        );

        if (subscriptions.length === 0) {
          throw new AppError(AppErrorCode.PREMIUM_PROFILE_URL, {
            message: 'Only subscribers can have a username shorter than 6 characters',
          });
        }
      }

      const user = await updatePublicProfile({
        userId: ctx.user.id,
        data: {
          url,
          bio,
          enabled,
        },
      });

      return { success: true, url: user.url };
    }),

  updatePassword: authenticatedProcedure
    .input(ZUpdatePasswordMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { password, currentPassword } = input;

      return await updatePassword({
        userId: ctx.user.id,
        password,
        currentPassword,
        requestMetadata: ctx.metadata.requestMetadata,
      });
    }),

  forgotPassword: procedure.input(ZForgotPasswordFormSchema).mutation(async ({ input }) => {
    const { email } = input;

    return await forgotPassword({
      email,
    });
  }),

  resetPassword: procedure.input(ZResetPasswordFormSchema).mutation(async ({ input, ctx }) => {
    const { password, token } = input;

    return await resetPassword({
      token,
      password,
      requestMetadata: extractNextApiRequestMetadata(ctx.req),
    });
  }),

  sendConfirmationEmail: procedure
    .input(ZConfirmEmailMutationSchema)
    .mutation(async ({ input }) => {
      const { email } = input;

      await jobsClient.triggerJob({
        name: 'send.signup.confirmation.email',
        payload: {
          email,
        },
      });
    }),

  deleteAccount: authenticatedProcedure.mutation(async ({ ctx }) => {
    return await deleteUser({
      id: ctx.user.id,
    });
  }),

  setProfileImage: authenticatedProcedure
    .input(ZSetProfileImageMutationSchema)
    .mutation(async ({ input, ctx }) => {
      const { bytes, teamId } = input;

      return await setAvatarImage({
        userId: ctx.user.id,
        teamId,
        bytes,
        requestMetadata: ctx.metadata,
      });
    }),
});
