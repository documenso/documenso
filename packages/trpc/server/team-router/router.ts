import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { getTeamPrices } from '@documenso/ee/server-only/stripe/get-team-prices';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { acceptTeamInvitation } from '@documenso/lib/server-only/team/accept-team-invitation';
import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { createTeamBillingPortal } from '@documenso/lib/server-only/team/create-team-billing-portal';
import { createTeamPendingCheckoutSession } from '@documenso/lib/server-only/team/create-team-checkout-session';
import { createTeamEmailVerification } from '@documenso/lib/server-only/team/create-team-email-verification';
import { createTeamMemberInvites } from '@documenso/lib/server-only/team/create-team-member-invites';
import { declineTeamInvitation } from '@documenso/lib/server-only/team/decline-team-invitation';
import { deleteTeam } from '@documenso/lib/server-only/team/delete-team';
import { deleteTeamEmail } from '@documenso/lib/server-only/team/delete-team-email';
import { deleteTeamEmailVerification } from '@documenso/lib/server-only/team/delete-team-email-verification';
import { deleteTeamMemberInvitations } from '@documenso/lib/server-only/team/delete-team-invitations';
import { deleteTeamMembers } from '@documenso/lib/server-only/team/delete-team-members';
import { deleteTeamPending } from '@documenso/lib/server-only/team/delete-team-pending';
import { deleteTeamTransferRequest } from '@documenso/lib/server-only/team/delete-team-transfer-request';
import { findTeamInvoices } from '@documenso/lib/server-only/team/find-team-invoices';
import { findTeamMemberInvites } from '@documenso/lib/server-only/team/find-team-member-invites';
import { findTeamMembers } from '@documenso/lib/server-only/team/find-team-members';
import { findTeams } from '@documenso/lib/server-only/team/find-teams';
import { findTeamsPending } from '@documenso/lib/server-only/team/find-teams-pending';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { getTeamEmailByEmail } from '@documenso/lib/server-only/team/get-team-email-by-email';
import { getTeamInvitations } from '@documenso/lib/server-only/team/get-team-invitations';
import { getTeamMembers } from '@documenso/lib/server-only/team/get-team-members';
import { getTeams } from '@documenso/lib/server-only/team/get-teams';
import { leaveTeam } from '@documenso/lib/server-only/team/leave-team';
import { requestTeamOwnershipTransfer } from '@documenso/lib/server-only/team/request-team-ownership-transfer';
import { resendTeamEmailVerification } from '@documenso/lib/server-only/team/resend-team-email-verification';
import { resendTeamMemberInvitation } from '@documenso/lib/server-only/team/resend-team-member-invitation';
import { updateTeam } from '@documenso/lib/server-only/team/update-team';
import { updateTeamBrandingSettings } from '@documenso/lib/server-only/team/update-team-branding-settings';
import { updateTeamEmail } from '@documenso/lib/server-only/team/update-team-email';
import { updateTeamMember } from '@documenso/lib/server-only/team/update-team-member';
import { updateTeamPublicProfile } from '@documenso/lib/server-only/team/update-team-public-profile';

import { authenticatedProcedure, router } from '../trpc';
import {
  ZAcceptTeamInvitationMutationSchema,
  ZCreateTeamBillingPortalMutationSchema,
  ZCreateTeamEmailVerificationMutationSchema,
  ZCreateTeamMemberInvitesMutationSchema,
  ZCreateTeamMutationSchema,
  ZCreateTeamPendingCheckoutMutationSchema,
  ZDeclineTeamInvitationMutationSchema,
  ZDeleteTeamEmailMutationSchema,
  ZDeleteTeamEmailVerificationMutationSchema,
  ZDeleteTeamMemberInvitationsMutationSchema,
  ZDeleteTeamMembersMutationSchema,
  ZDeleteTeamMutationSchema,
  ZDeleteTeamPendingMutationSchema,
  ZDeleteTeamTransferRequestMutationSchema,
  ZFindTeamInvoicesQuerySchema,
  ZFindTeamMemberInvitesQuerySchema,
  ZFindTeamMembersQuerySchema,
  ZFindTeamsPendingQuerySchema,
  ZFindTeamsQuerySchema,
  ZGetTeamMembersQuerySchema,
  ZGetTeamQuerySchema,
  ZLeaveTeamMutationSchema,
  ZRequestTeamOwnerhsipTransferMutationSchema,
  ZResendTeamEmailVerificationMutationSchema,
  ZResendTeamMemberInvitationMutationSchema,
  ZUpdateTeamBrandingSettingsMutationSchema,
  ZUpdateTeamEmailMutationSchema,
  ZUpdateTeamMemberMutationSchema,
  ZUpdateTeamMutationSchema,
  ZUpdateTeamPublicProfileMutationSchema,
} from './schema';
import { updateTeamDocumentSettingsRoute } from './update-team-document-settings';

export const teamRouter = router({
  // Internal endpoint for now.
  getTeams: authenticatedProcedure.query(async ({ ctx }) => {
    return await getTeams({ userId: ctx.user.id });
  }),

  // Todo: Public endpoint.
  findTeams: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'GET',
    //     path: '/team',
    //     summary: 'Find teams',
    //     description: 'Find your teams based on a search criteria',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZFindTeamsQuerySchema)
    .query(async ({ input, ctx }) => {
      return await findTeams({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Todo: Public endpoint.
  getTeam: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'GET',
    //     path: '/team/{teamId}',
    //     summary: 'Get team',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZGetTeamQuerySchema)
    .query(async ({ input, ctx }) => {
      return await getTeamById({ teamId: input.teamId, userId: ctx.user.id });
    }),

  // Todo: Public endpoint.
  createTeam: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/create',
    //     summary: 'Create team',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZCreateTeamMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await createTeam({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Todo: Public endpoint.
  updateTeam: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/{teamId}',
    //     summary: 'Update team',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZUpdateTeamMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await updateTeam({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Todo: Public endpoint.
  deleteTeam: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/{teamId}/delete',
    //     summary: 'Delete team',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZDeleteTeamMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeam({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Todo: Public endpoint.
  leaveTeam: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/{teamId}/leave',
    //     summary: 'Leave a team',
    //     description: '',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZLeaveTeamMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await leaveTeam({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Todo: Public endpoint.
  findTeamMemberInvites: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'GET',
    //     path: '/team/{teamId}/member/invite',
    //     summary: 'Find member invites',
    //     description: 'Returns pending team member invites',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZFindTeamMemberInvitesQuerySchema)
    .query(async ({ input, ctx }) => {
      return await findTeamMemberInvites({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Todo: Public endpoint.
  createTeamMemberInvites: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/{teamId}/member/invite',
    //     summary: 'Invite members',
    //     description: 'Send email invitations to users to join the team',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZCreateTeamMemberInvitesMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await createTeamMemberInvites({
        userId: ctx.user.id,
        userName: ctx.user.name ?? '',
        ...input,
      });
    }),

  // Todo: Public endpoint.
  resendTeamMemberInvitation: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/{teamId}/member/invite/{invitationId}/resend',
    //     summary: 'Resend member invite',
    //     description: 'Resend an email invitation to a user to join the team',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZResendTeamMemberInvitationMutationSchema)
    .mutation(async ({ input, ctx }) => {
      await resendTeamMemberInvitation({
        userId: ctx.user.id,
        userName: ctx.user.name ?? '',
        ...input,
      });
    }),

  // Todo: Public endpoint.
  deleteTeamMemberInvitations: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/{teamId}/member/invite/delete',
    //     summary: 'Delete member invite',
    //     description: 'Delete a pending team member invite',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZDeleteTeamMemberInvitationsMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamMemberInvitations({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Todo: Public endpoint.
  getTeamMembers: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'GET',
    //     path: '/team/{teamId}/member',
    //     summary: 'Get members',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZGetTeamMembersQuerySchema)
    .query(async ({ input, ctx }) => {
      return await getTeamMembers({ teamId: input.teamId, userId: ctx.user.id });
    }),

  // Todo: Public endpoint.
  findTeamMembers: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'GET',
    //     path: '/team/{teamId}/member/find',
    //     summary: 'Find members',
    //     description: 'Find team members based on a search criteria',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZFindTeamMembersQuerySchema)
    .query(async ({ input, ctx }) => {
      return await findTeamMembers({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Todo: Public endpoint.
  updateTeamMember: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/{teamId}/member/{teamMemberId}',
    //     summary: 'Update member',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZUpdateTeamMemberMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await updateTeamMember({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Todo: Public endpoint.
  deleteTeamMembers: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/{teamId}/member/delete',
    //     summary: 'Delete members',
    //     description: '',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZDeleteTeamMembersMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamMembers({
        userId: ctx.user.id,
        ...input,
      });
    }),

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

  // Internal endpoint for now.
  getTeamInvitations: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'GET',
    //     path: '/team/invite',
    //     summary: 'Get team invitations',
    //     description: '',
    //     tags: ['Teams'],
    //   },
    // })
    .input(z.void())
    .query(async ({ ctx }) => {
      return await getTeamInvitations({ email: ctx.user.email });
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

  // Internal endpoint for now.
  requestTeamOwnershipTransfer: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/{teamId}/transfer',
    //     summary: 'Request a team ownership transfer',
    //     description: '',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZRequestTeamOwnerhsipTransferMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await requestTeamOwnershipTransfer({
        userId: ctx.user.id,
        userName: ctx.user.name ?? '',
        ...input,
      });
    }),

  // Internal endpoint for now.
  deleteTeamTransferRequest: authenticatedProcedure
    // .meta({
    //   openapi: {
    //     method: 'POST',
    //     path: '/team/{teamId}/transfer/delete',
    //     summary: 'Delete team transfer request',
    //     tags: ['Teams'],
    //   },
    // })
    .input(ZDeleteTeamTransferRequestMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamTransferRequest({
        userId: ctx.user.id,
        ...input,
      });
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

  // Internal endpoint. Use updateTeam instead.
  updateTeamBrandingSettings: authenticatedProcedure
    .input(ZUpdateTeamBrandingSettingsMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const { teamId, settings } = input;

      return await updateTeamBrandingSettings({
        userId: ctx.user.id,
        teamId,
        settings,
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
  findTeamInvoices: authenticatedProcedure
    .input(ZFindTeamInvoicesQuerySchema)
    .query(async ({ input, ctx }) => {
      return await findTeamInvoices({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Internal endpoint for now.
  getTeamPrices: authenticatedProcedure.query(async () => {
    return await getTeamPrices();
  }),

  updateTeamDocumentSettings: updateTeamDocumentSettingsRoute,

  // Internal endpoint for now.
  acceptTeamInvitation: authenticatedProcedure
    .input(ZAcceptTeamInvitationMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await acceptTeamInvitation({
        teamId: input.teamId,
        userId: ctx.user.id,
      });
    }),

  // Internal endpoint for now.
  declineTeamInvitation: authenticatedProcedure
    .input(ZDeclineTeamInvitationMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await declineTeamInvitation({
        teamId: input.teamId,
        userId: ctx.user.id,
      });
    }),

  // Internal endpoint for now.
  createBillingPortal: authenticatedProcedure
    .input(ZCreateTeamBillingPortalMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await createTeamBillingPortal({
        userId: ctx.user.id,
        ...input,
      });
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
