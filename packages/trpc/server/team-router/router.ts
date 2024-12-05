import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { getTeamPrices } from '@documenso/ee/server-only/stripe/get-team-prices';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { acceptTeamInvitation } from '@documenso/lib/server-only/team/accept-team-invitation';
import { ZCreateTeamResponseSchema, createTeam } from '@documenso/lib/server-only/team/create-team';
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
import {
  ZFindTeamMemberInvitesResponseSchema,
  findTeamMemberInvites,
} from '@documenso/lib/server-only/team/find-team-member-invites';
import {
  ZFindTeamMembersResponseSchema,
  findTeamMembers,
} from '@documenso/lib/server-only/team/find-team-members';
import { findTeams } from '@documenso/lib/server-only/team/find-teams';
import {
  ZFindTeamsPendingResponseSchema,
  findTeamsPending,
} from '@documenso/lib/server-only/team/find-teams-pending';
import { ZGetTeamByIdResponseSchema, getTeamById } from '@documenso/lib/server-only/team/get-team';
import { getTeamEmailByEmail } from '@documenso/lib/server-only/team/get-team-email-by-email';
import {
  ZGetTeamInvitationsResponseSchema,
  getTeamInvitations,
} from '@documenso/lib/server-only/team/get-team-invitations';
import {
  ZGetTeamMembersResponseSchema,
  getTeamMembers,
} from '@documenso/lib/server-only/team/get-team-members';
import { ZGetTeamsResponseSchema, getTeams } from '@documenso/lib/server-only/team/get-teams';
import { leaveTeam } from '@documenso/lib/server-only/team/leave-team';
import { requestTeamOwnershipTransfer } from '@documenso/lib/server-only/team/request-team-ownership-transfer';
import { resendTeamEmailVerification } from '@documenso/lib/server-only/team/resend-team-email-verification';
import { resendTeamMemberInvitation } from '@documenso/lib/server-only/team/resend-team-member-invitation';
import { updateTeam } from '@documenso/lib/server-only/team/update-team';
import {
  ZUpdateTeamBrandingSettingsResponseSchema,
  updateTeamBrandingSettings,
} from '@documenso/lib/server-only/team/update-team-branding-settings';
import {
  ZUpdateTeamDocumentSettingsResponseSchema,
  updateTeamDocumentSettings,
} from '@documenso/lib/server-only/team/update-team-document-settings';
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

  createTeam: authenticatedProcedure
    .meta({ openapi: { method: 'POST', path: '/team' } })
    .input(ZCreateTeamMutationSchema)
    .output(ZCreateTeamResponseSchema)
    .mutation(async ({ input, ctx }) => {
      return await createTeam({
        userId: ctx.user.id,
        ...input,
      });
    }),

  createTeamEmailVerification: authenticatedProcedure
    .meta({ openapi: { method: 'POST', path: '/team/{teamId}/email' } })
    .input(ZCreateTeamEmailVerificationMutationSchema)
    .output(z.void())
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
    .meta({ openapi: { method: 'POST', path: '/team/{teamId}/member/invite' } })
    .input(ZCreateTeamMemberInvitesMutationSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      return await createTeamMemberInvites({
        userId: ctx.user.id,
        userName: ctx.user.name ?? '',
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

  deleteTeam: authenticatedProcedure
    // .meta({ openapi: { method: 'DELETE', path: '/team/{teamId}' } })
    .input(ZDeleteTeamMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeam({
        userId: ctx.user.id,
        ...input,
      });
    }),

  deleteTeamEmail: authenticatedProcedure
    // .meta({ openapi: { method: 'DELETE', path: '/team/{teamId}/email' } })
    .input(ZDeleteTeamEmailMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamEmail({
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        ...input,
      });
    }),

  deleteTeamEmailVerification: authenticatedProcedure
    // .meta({ openapi: { method: 'DELETE', path: '/team/{teamId}/email-verification' } })
    .input(ZDeleteTeamEmailVerificationMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamEmailVerification({
        userId: ctx.user.id,
        ...input,
      });
    }),

  deleteTeamMemberInvitations: authenticatedProcedure
    // .meta({ openapi: { method: 'DELETE', path: '/team/{teamId}/member/invite' } })
    .input(ZDeleteTeamMemberInvitationsMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamMemberInvitations({
        userId: ctx.user.id,
        ...input,
      });
    }),

  deleteTeamMembers: authenticatedProcedure
    // .meta({ openapi: { method: 'DELETE', path: '/team/{teamId}/member' } })
    .input(ZDeleteTeamMembersMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamMembers({
        userId: ctx.user.id,
        ...input,
      });
    }),

  deleteTeamPending: authenticatedProcedure
    // .meta({ openapi: { method: 'DELETE', path: '/team-pending/{pendingTeamId}' } })
    .input(ZDeleteTeamPendingMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamPending({
        userId: ctx.user.id,
        ...input,
      });
    }),

  deleteTeamTransferRequest: authenticatedProcedure
    // .meta({ openapi: { method: 'DELETE', path: '/team/{teamId}/transfer' } })
    .input(ZDeleteTeamTransferRequestMutationSchema)
    .mutation(async ({ input, ctx }) => {
      return await deleteTeamTransferRequest({
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

  findTeamMemberInvites: authenticatedProcedure
    .meta({ openapi: { method: 'GET', path: '/team/{teamId}/member/invite' } })
    .input(ZFindTeamMemberInvitesQuerySchema)
    .output(ZFindTeamMemberInvitesResponseSchema)
    .query(async ({ input, ctx }) => {
      return await findTeamMemberInvites({
        userId: ctx.user.id,
        ...input,
      });
    }),

  findTeamMembers: authenticatedProcedure
    .meta({ openapi: { method: 'GET', path: '/team/{teamId}/member' } })
    .input(ZFindTeamMembersQuerySchema)
    .output(ZFindTeamMembersResponseSchema)
    .query(async ({ input, ctx }) => {
      return await findTeamMembers({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Todo: Refactor, seems to be a redundant endpoint.
  findTeams: authenticatedProcedure.input(ZFindTeamsQuerySchema).query(async ({ input, ctx }) => {
    return await findTeams({
      userId: ctx.user.id,
      ...input,
    });
  }),

  findTeamsPending: authenticatedProcedure
    .meta({ openapi: { method: 'GET', path: '/team-pending' } })
    .input(ZFindTeamsPendingQuerySchema)
    .output(ZFindTeamsPendingResponseSchema)
    .query(async ({ input, ctx }) => {
      return await findTeamsPending({
        userId: ctx.user.id,
        ...input,
      });
    }),

  getTeam: authenticatedProcedure
    .meta({ openapi: { method: 'GET', path: '/team/{teamId}' } })
    .input(ZGetTeamQuerySchema)
    .output(ZGetTeamByIdResponseSchema)
    .query(async ({ input, ctx }) => {
      return await getTeamById({ teamId: input.teamId, userId: ctx.user.id });
    }),

  // Todo
  getTeamEmailByEmail: authenticatedProcedure.query(async ({ ctx }) => {
    return await getTeamEmailByEmail({ email: ctx.user.email });
  }),

  getTeamInvitations: authenticatedProcedure
    .meta({ openapi: { method: 'GET', path: '/team/invite' } })
    .input(z.void())
    .output(ZGetTeamInvitationsResponseSchema)
    .query(async ({ ctx }) => {
      return await getTeamInvitations({ email: ctx.user.email });
    }),

  getTeamMembers: authenticatedProcedure
    .meta({ openapi: { method: 'GET', path: '/team/member' } })
    .input(ZGetTeamMembersQuerySchema)
    .output(ZGetTeamMembersResponseSchema)
    .query(async ({ input, ctx }) => {
      return await getTeamMembers({ teamId: input.teamId, userId: ctx.user.id });
    }),

  // Internal endpoint for now.
  getTeamPrices: authenticatedProcedure.query(async () => {
    return await getTeamPrices();
  }),

  getTeams: authenticatedProcedure
    .meta({ openapi: { method: 'GET', path: '/team' } })
    .input(z.void())
    .output(ZGetTeamsResponseSchema)
    .query(async ({ ctx }) => {
      return await getTeams({ userId: ctx.user.id });
    }),

  leaveTeam: authenticatedProcedure
    .meta({ openapi: { method: 'POST', path: '/team/{teamId}/leave' } })
    .input(ZLeaveTeamMutationSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      return await leaveTeam({
        userId: ctx.user.id,
        ...input,
      });
    }),

  updateTeam: authenticatedProcedure
    .meta({ openapi: { method: 'PATCH', path: '/team/{teamId}' } })
    .input(ZUpdateTeamMutationSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      return await updateTeam({
        userId: ctx.user.id,
        ...input,
      });
    }),

  updateTeamEmail: authenticatedProcedure
    .meta({ openapi: { method: 'PATCH', path: '/team/{teamId}/email' } })
    .input(ZUpdateTeamEmailMutationSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      return await updateTeamEmail({
        userId: ctx.user.id,
        ...input,
      });
    }),

  updateTeamMember: authenticatedProcedure
    .meta({ openapi: { method: 'PATCH', path: '/team/{teamId}/member' } })
    .input(ZUpdateTeamMemberMutationSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      return await updateTeamMember({
        userId: ctx.user.id,
        ...input,
      });
    }),

  updateTeamPublicProfile: authenticatedProcedure
    .meta({ openapi: { method: 'PATCH', path: '/team/{teamId}/profile' } })
    .input(ZUpdateTeamPublicProfileMutationSchema)
    .output(z.void())
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

  requestTeamOwnershipTransfer: authenticatedProcedure
    .meta({ openapi: { method: 'POST', path: '/team/{teamId}/transfer' } })
    .input(ZRequestTeamOwnerhsipTransferMutationSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      return await requestTeamOwnershipTransfer({
        userId: ctx.user.id,
        userName: ctx.user.name ?? '',
        ...input,
      });
    }),

  resendTeamEmailVerification: authenticatedProcedure
    .meta({ openapi: { method: 'POST', path: '/team/{teamId}/email/resend' } })
    .input(ZResendTeamEmailVerificationMutationSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      await resendTeamEmailVerification({
        userId: ctx.user.id,
        ...input,
      });
    }),

  resendTeamMemberInvitation: authenticatedProcedure
    .meta({
      openapi: { method: 'POST', path: '/team/{teamId}/member/invite/{invitationId}/resend' },
    })
    .input(ZResendTeamMemberInvitationMutationSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      await resendTeamMemberInvitation({
        userId: ctx.user.id,
        userName: ctx.user.name ?? '',
        ...input,
      });
    }),

  updateTeamBrandingSettings: authenticatedProcedure
    .meta({ openapi: { method: 'PATCH', path: '/team/{teamId}/branding' } })
    .input(ZUpdateTeamBrandingSettingsMutationSchema)
    .output(ZUpdateTeamBrandingSettingsResponseSchema)
    .mutation(async ({ ctx, input }) => {
      const { teamId, settings } = input;

      return await updateTeamBrandingSettings({
        userId: ctx.user.id,
        teamId,
        settings,
      });
    }),

  updateTeamDocumentSettings: authenticatedProcedure
    .meta({ openapi: { method: 'PATCH', path: '/team/{teamId}/settings' } })
    .input(ZUpdateTeamDocumentSettingsMutationSchema)
    .output(ZUpdateTeamDocumentSettingsResponseSchema)
    .mutation(async ({ ctx, input }) => {
      const { teamId, settings } = input;

      return await updateTeamDocumentSettings({
        userId: ctx.user.id,
        teamId,
        settings,
      });
    }),
});
