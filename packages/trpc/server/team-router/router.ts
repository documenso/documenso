import { TRPCError } from '@trpc/server';

import { getTeamPrices } from '@documenso/ee/server-only/stripe/get-team-prices';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createTeamPendingCheckoutSession } from '@documenso/lib/server-only/team/create-team-checkout-session';
import { createTeamEmailVerification } from '@documenso/lib/server-only/team/create-team-email-verification';
import { deleteTeamEmail } from '@documenso/lib/server-only/team/delete-team-email';
import { deleteTeamEmailVerification } from '@documenso/lib/server-only/team/delete-team-email-verification';
import { deleteTeamPending } from '@documenso/lib/server-only/team/delete-team-pending';
import { findTeamsPending } from '@documenso/lib/server-only/team/find-teams-pending';
import { getTeamEmailByEmail } from '@documenso/lib/server-only/team/get-team-email-by-email';
import { resendTeamEmailVerification } from '@documenso/lib/server-only/team/resend-team-email-verification';
import { updateTeamEmail } from '@documenso/lib/server-only/team/update-team-email';
import { updateTeamPublicProfile } from '@documenso/lib/server-only/team/update-team-public-profile';

import { authenticatedProcedure, router } from '../trpc';
import { createTeamRoute } from './create-team';
import { createTeamGroupsRoute } from './create-team-groups';
import { createTeamMembersRoute } from './create-team-members';
import { deleteTeamRoute } from './delete-team';
import { deleteTeamGroupRoute } from './delete-team-group';
import { deleteTeamMemberRoute } from './delete-team-member';
import { findTeamGroupsRoute } from './find-team-groups';
import { findTeamMembersRoute } from './find-team-members';
import { findTeamsRoute } from './find-teams';
import { getTeamRoute } from './get-team';
import { getTeamMembersRoute } from './get-team-members';
import {
  ZCreateTeamEmailVerificationMutationSchema,
  ZCreateTeamPendingCheckoutMutationSchema,
  ZDeleteTeamEmailMutationSchema,
  ZDeleteTeamEmailVerificationMutationSchema,
  ZDeleteTeamPendingMutationSchema,
  ZFindTeamsPendingQuerySchema,
  ZResendTeamEmailVerificationMutationSchema,
  ZUpdateTeamEmailMutationSchema,
  ZUpdateTeamPublicProfileMutationSchema,
} from './schema';
import { updateTeamRoute } from './update-team';
import { updateTeamGroupRoute } from './update-team-group';
import { updateTeamMemberRoute } from './update-team-member';
import { updateTeamSettingsRoute } from './update-team-settings';

export const teamRouter = router({
  find: findTeamsRoute,
  get: getTeamRoute,
  create: createTeamRoute,
  update: updateTeamRoute,
  delete: deleteTeamRoute,
  member: {
    find: findTeamMembersRoute,
    getMany: getTeamMembersRoute,
    createMany: createTeamMembersRoute,
    update: updateTeamMemberRoute,
    delete: deleteTeamMemberRoute,
  },
  group: {
    find: findTeamGroupsRoute,
    createMany: createTeamGroupsRoute,
    update: updateTeamGroupRoute,
    delete: deleteTeamGroupRoute,
  },
  settings: {
    update: updateTeamSettingsRoute,
  },

  // Old routes (to be migrated)

  // Internal endpoint for now.
  createTeamEmailVerification: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/{teamId}/email/create',
    //     summary: 'Create team email',
    //     description: 'Add an email to a team and send an email request to verify it',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZCreateTeamEmailVerificationMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await createTeamEmailVerification({
        teamId: input.teamId,
        userId: ctx.user.id,
        data: {
          email: input.email,
          name: input.name,
        },
      });
    }),

  // Todo: Public endpoint.
  updateTeamPublicProfile: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/{teamId}/profile',
    //     summary: 'Update a team public profile',
    //     description: '',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZUpdateTeamPublicProfileMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { teamId, bio, enabled } = input;

        await updateTeamPublicProfile({
          userId: ctx.user.id,
          teamId,
          data: {
            bio,
            enabled,
          },
        });
      } catch (err) {
        console.error(err);

        const error = AppError.parseError(err);

        if (error.code !== AppErrorCode.UNKNOWN_ERROR) {
          throw error;
        }

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'We were unable to update your public profile. Please review the information you provided and try again.',
        });
      }
    }),

  // Todo
  getTeamEmailByEmail: authenticatedProcedure.query(async ({ ctx }) => {
    return await getTeamEmailByEmail({ email: ctx.user.email });
  }),

  // Internal endpoint for now.
  updateTeamEmail: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/{teamId}/email',
    //     summary: 'Update a team email',
    //     description: '',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZUpdateTeamEmailMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await updateTeamEmail({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Internal endpoint for now.
  deleteTeamEmail: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/{teamId}/email/delete',
    //     summary: 'Delete team email',
    //     description: '',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZDeleteTeamEmailMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamEmail({
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        ...input,
      });
    }),

  // Internal endpoint for now.
  resendTeamEmailVerification: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/{teamId}/email/resend',
    //     summary: 'Resend team email verification',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZResendTeamEmailVerificationMutationSchema)
    .mutation(async ({ input, ctx }) => {
      await resendTeamEmailVerification({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Internal endpoint for now.
  deleteTeamEmailVerification: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/{teamId}/email/verify/delete',
    //     summary: 'Delete team email verification',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZDeleteTeamEmailVerificationMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamEmailVerification({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Internal endpoint for now.
  createTeamPendingCheckout: authenticatedProcedure
    .input(ZCreateTeamPendingCheckoutMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await createTeamPendingCheckoutSession({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Internal endpoint for now.
  getTeamPrices: authenticatedProcedure.query(async () => {
    return await getTeamPrices();
  }),

  // Internal endpoint for now.
  findTeamsPending: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'GET',
    //     path: '/team/pending',
    //     summary: 'Find pending teams',
    //     description: 'Find teams that are pending payment',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZFindTeamsPendingQuerySchema)
    .query(async ({ input, ctx }) => {
      return await findTeamsPending({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Internal endpoint for now.
  deleteTeamPending: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/pending/{pendingTeamId}/delete',
    //     summary: 'Delete pending team',
    //     description: '',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZDeleteTeamPendingMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamPending({
        userId: ctx.user.id,
        ...input,
      });
    }),
});
