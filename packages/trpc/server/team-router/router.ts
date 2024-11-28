import { TRPCError } from '@trpc/server';

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
import { updateTeamDocumentSettings } from '@documenso/lib/server-only/team/update-team-document-settings';
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
  ZUpdateTeamDocumentSettingsMutationSchema,
  ZUpdateTeamEmailMutationSchema,
  ZUpdateTeamMemberMutationSchema,
  ZUpdateTeamMutationSchema,
  ZUpdateTeamPublicProfileMutationSchema,
} from './schema';

export const teamRouter = router({
  acceptTeamInvitation: authenticatedProcedure
    .input(ZAcceptTeamInvitationMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await acceptTeamInvitation({
        teamId: input.teamId,
        userId: ctx.user.id,
      });
    }),

  declineTeamInvitation: authenticatedProcedure
    .input(ZDeclineTeamInvitationMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await declineTeamInvitation({
        teamId: input.teamId,
        userId: ctx.user.id,
      });
    }),

  createBillingPortal: authenticatedProcedure
    .input(ZCreateTeamBillingPortalMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await createTeamBillingPortal({
        userId: ctx.user.id,
        ...input,
      });
    }),

  createTeam: authenticatedProcedure
    .input(ZCreateTeamMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await createTeam({
        userId: ctx.user.id,
        ...input,
      });
    }),

  createTeamEmailVerification: authenticatedProcedure
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

  createTeamMemberInvites: authenticatedProcedure
    .input(ZCreateTeamMemberInvitesMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await createTeamMemberInvites({
        userId: ctx.user.id,
        userName: ctx.user.name ?? '',
        ...input,
      });
    }),

  createTeamPendingCheckout: authenticatedProcedure
    .input(ZCreateTeamPendingCheckoutMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await createTeamPendingCheckoutSession({
        userId: ctx.user.id,
        ...input,
      });
    }),

  deleteTeam: authenticatedProcedure
    .input(ZDeleteTeamMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeam({
        userId: ctx.user.id,
        ...input,
      });
    }),

  deleteTeamEmail: authenticatedProcedure
    .input(ZDeleteTeamEmailMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamEmail({
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        ...input,
      });
    }),

  deleteTeamEmailVerification: authenticatedProcedure
    .input(ZDeleteTeamEmailVerificationMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamEmailVerification({
        userId: ctx.user.id,
        ...input,
      });
    }),

  deleteTeamMemberInvitations: authenticatedProcedure
    .input(ZDeleteTeamMemberInvitationsMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamMemberInvitations({
        userId: ctx.user.id,
        ...input,
      });
    }),

  deleteTeamMembers: authenticatedProcedure
    .input(ZDeleteTeamMembersMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamMembers({
        userId: ctx.user.id,
        ...input,
      });
    }),

  deleteTeamPending: authenticatedProcedure
    .input(ZDeleteTeamPendingMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamPending({
        userId: ctx.user.id,
        ...input,
      });
    }),

  deleteTeamTransferRequest: authenticatedProcedure
    .input(ZDeleteTeamTransferRequestMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamTransferRequest({
        userId: ctx.user.id,
        ...input,
      });
    }),

  findTeamInvoices: authenticatedProcedure
    .input(ZFindTeamInvoicesQuerySchema)
    .query(async ({ input, ctx }) => {
      return await findTeamInvoices({
        userId: ctx.user.id,
        ...input,
      });
    }),

  findTeamMemberInvites: authenticatedProcedure
    .input(ZFindTeamMemberInvitesQuerySchema)
    .query(async ({ input, ctx }) => {
      return await findTeamMemberInvites({
        userId: ctx.user.id,
        ...input,
      });
    }),

  findTeamMembers: authenticatedProcedure
    .input(ZFindTeamMembersQuerySchema)
    .query(async ({ input, ctx }) => {
      return await findTeamMembers({
        userId: ctx.user.id,
        ...input,
      });
    }),

  findTeams: authenticatedProcedure.input(ZFindTeamsQuerySchema).query(async ({ input, ctx }) => {
    return await findTeams({
      userId: ctx.user.id,
      ...input,
    });
  }),

  findTeamsPending: authenticatedProcedure
    .input(ZFindTeamsPendingQuerySchema)
    .query(async ({ input, ctx }) => {
      return await findTeamsPending({
        userId: ctx.user.id,
        ...input,
      });
    }),

  getTeam: authenticatedProcedure.input(ZGetTeamQuerySchema).query(async ({ input, ctx }) => {
    return await getTeamById({ teamId: input.teamId, userId: ctx.user.id });
  }),

  getTeamEmailByEmail: authenticatedProcedure.query(async ({ ctx }) => {
    return await getTeamEmailByEmail({ email: ctx.user.email });
  }),

  getTeamInvitations: authenticatedProcedure.query(async ({ ctx }) => {
    return await getTeamInvitations({ email: ctx.user.email });
  }),

  getTeamMembers: authenticatedProcedure
    .input(ZGetTeamMembersQuerySchema)
    .query(async ({ input, ctx }) => {
      return await getTeamMembers({ teamId: input.teamId, userId: ctx.user.id });
    }),

  getTeamPrices: authenticatedProcedure.query(async () => {
    return await getTeamPrices();
  }),

  getTeams: authenticatedProcedure.query(async ({ ctx }) => {
    return await getTeams({ userId: ctx.user.id });
  }),

  leaveTeam: authenticatedProcedure
    .input(ZLeaveTeamMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await leaveTeam({
        userId: ctx.user.id,
        ...input,
      });
    }),

  updateTeam: authenticatedProcedure
    .input(ZUpdateTeamMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await updateTeam({
        userId: ctx.user.id,
        ...input,
      });
    }),

  updateTeamEmail: authenticatedProcedure
    .input(ZUpdateTeamEmailMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await updateTeamEmail({
        userId: ctx.user.id,
        ...input,
      });
    }),

  updateTeamMember: authenticatedProcedure
    .input(ZUpdateTeamMemberMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await updateTeamMember({
        userId: ctx.user.id,
        ...input,
      });
    }),

  updateTeamPublicProfile: authenticatedProcedure
    .input(ZUpdateTeamPublicProfileMutationSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { teamId, bio, enabled } = input;

        const team = await updateTeamPublicProfile({
          userId: ctx.user.id,
          teamId,
          data: {
            bio,
            enabled,
          },
        });

        return { success: true, url: team.url };
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

  requestTeamOwnershipTransfer: authenticatedProcedure
    .input(ZRequestTeamOwnerhsipTransferMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await requestTeamOwnershipTransfer({
        userId: ctx.user.id,
        userName: ctx.user.name ?? '',
        ...input,
      });
    }),

  resendTeamEmailVerification: authenticatedProcedure
    .input(ZResendTeamEmailVerificationMutationSchema)
    .mutation(async ({ input, ctx }) => {
      await resendTeamEmailVerification({
        userId: ctx.user.id,
        ...input,
      });
    }),

  resendTeamMemberInvitation: authenticatedProcedure
    .input(ZResendTeamMemberInvitationMutationSchema)
    .mutation(async ({ input, ctx }) => {
      await resendTeamMemberInvitation({
        userId: ctx.user.id,
        userName: ctx.user.name ?? '',
        ...input,
      });
    }),

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

  updateTeamDocumentSettings: authenticatedProcedure
    .input(ZUpdateTeamDocumentSettingsMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const { teamId, settings } = input;

      return await updateTeamDocumentSettings({
        userId: ctx.user.id,
        teamId,
        settings,
      });
    }),
});
