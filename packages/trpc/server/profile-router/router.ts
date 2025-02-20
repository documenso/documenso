import { SubscriptionStatus } from '@prisma/client';

import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';
import { setAvatarImage } from '@documenso/lib/server-only/profile/set-avatar-image';
import { getSubscriptionsByUserId } from '@documenso/lib/server-only/subscription/get-subscriptions-by-user-id';
import { createBillingPortal } from '@documenso/lib/server-only/user/create-billing-portal';
import { createCheckoutSession } from '@documenso/lib/server-only/user/create-checkout-session';
import { deleteUser } from '@documenso/lib/server-only/user/delete-user';
import { findUserSecurityAuditLogs } from '@documenso/lib/server-only/user/find-user-security-audit-logs';
import { getUserById } from '@documenso/lib/server-only/user/get-user-by-id';
import { updateProfile } from '@documenso/lib/server-only/user/update-profile';
import { updatePublicProfile } from '@documenso/lib/server-only/user/update-public-profile';

import { adminProcedure, authenticatedProcedure, router } from '../trpc';
import {
  ZCreateCheckoutSessionRequestSchema,
  ZFindUserSecurityAuditLogsSchema,
  ZRetrieveUserByIdQuerySchema,
  ZSetProfileImageMutationSchema,
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

  createBillingPortal: authenticatedProcedure.mutation(async ({ ctx }) => {
    return await createBillingPortal({
      user: {
        id: ctx.user.id,
        customerId: ctx.user.customerId,
        email: ctx.user.email,
        name: ctx.user.name,
      },
    });
  }),

  createCheckoutSession: authenticatedProcedure
    .input(ZCreateCheckoutSessionRequestSchema)
    .mutation(async ({ ctx, input }) => {
      return await createCheckoutSession({
        user: {
          id: ctx.user.id,
          customerId: ctx.user.customerId,
          email: ctx.user.email,
          name: ctx.user.name,
        },
        priceId: input.priceId,
      });
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
          throw new AppError('PREMIUM_PROFILE_URL', {
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
