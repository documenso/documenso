import { router } from '../trpc';
import { acceptTeamInvitationRoute } from './accept-team-invitation-route';
import { createBillingPortalRoute } from './create-billing-portal-route';
import { createTeamEmailVerificationRoute } from './create-team-email-verification-route';
import { createTeamMemberInvitesRoute } from './create-team-member-invites-route';
import { createTeamPendingCheckoutRoute } from './create-team-pending-checkout-route';
import { createTeamRoute } from './create-team-route';
import { declineTeamInvitationRoute } from './decline-team-invitation-route';
import { deleteTeamEmailRequestRoute } from './delete-team-email-route';
import { deleteTeamEmailVerificationRoute } from './delete-team-email-verification-route';
import { deleteTeamMemberInvitationRoute } from './delete-team-member-invitation-route';
import { deleteTeamMembersRoute } from './delete-team-members-route';
import { deleteTeamPendingRoute } from './delete-team-pending-route';
import { deleteTeamRoute } from './delete-team-route';
import { deleteTeamTransferRequestRoute } from './delete-team-transfer-request-route';
import { findTeamInvoicesRoute } from './find-team-invoices-route';
import { findTeamMemberInvitesRoute } from './find-team-member-invites-route';
import { findTeamMembersRoute } from './find-team-members-route';
import { findTeamsPendingRoute } from './find-teams-pending-route';
import { findTeamsRoute } from './find-teams-route';
import { getTeamEmailByEmailRoute } from './get-team-email-by-email-route';
import { getTeamInvitationsRoute } from './get-team-invitations-route';
import { getTeamMembersRoute } from './get-team-members-route';
import { getTeamPricesRoute } from './get-team-prices-route';
import { getTeamRoute } from './get-team-route';
import { getTeamsRoute } from './get-teams-route';
import { leaveTeamRoute } from './leave-team-route';
import { requestTeamOwnershipTransferRoute } from './request-team-ownership-transfer-route';
import { resendTeamEmailVerificationRoute } from './resend-team-email-verification-route';
import { resendTeamMemberInvitationRoute } from './resend-team-member-invitation-route';
import { updateTeamBrandingSettingsRoute } from './update-team-branding-settings-route';
import { updateTeamDocumentSettingsRoute } from './update-team-document-settings-route';
import { updateTeamEmailRequestRoute } from './update-team-email-route';
import { updateTeamMemberRoute } from './update-team-member-route';
import { updateTeamPublicProfileRoute } from './update-team-public-profile-route';
import { updateTeamRoute } from './update-team-route';

export const teamRouter = router({
  findTeams: findTeamsRoute,
  getTeams: getTeamsRoute,
  getTeam: getTeamRoute,
  createTeam: createTeamRoute,
  updateTeam: updateTeamRoute,
  deleteTeam: deleteTeamRoute,
  leaveTeam: leaveTeamRoute,

  findTeamMemberInvites: findTeamMemberInvitesRoute,
  getTeamInvitations: getTeamInvitationsRoute,
  createTeamMemberInvites: createTeamMemberInvitesRoute,
  resendTeamMemberInvitation: resendTeamMemberInvitationRoute,
  acceptTeamInvitation: acceptTeamInvitationRoute,
  declineTeamInvitation: declineTeamInvitationRoute,
  deleteTeamMemberInvitations: deleteTeamMemberInvitationRoute,

  findTeamMembers: findTeamMembersRoute,
  getTeamMembers: getTeamMembersRoute,
  updateTeamMember: updateTeamMemberRoute,
  deleteTeamMembers: deleteTeamMembersRoute,

  createTeamEmailVerification: createTeamEmailVerificationRoute,
  updateTeamPublicProfile: updateTeamPublicProfileRoute,
  requestTeamOwnershipTransfer: requestTeamOwnershipTransferRoute,
  deleteTeamTransferRequest: deleteTeamTransferRequestRoute,
  getTeamEmailByEmail: getTeamEmailByEmailRoute,
  updateTeamEmail: updateTeamEmailRequestRoute,
  deleteTeamEmail: deleteTeamEmailRequestRoute,

  resendTeamEmailVerification: resendTeamEmailVerificationRoute,
  deleteTeamEmailVerification: deleteTeamEmailVerificationRoute,

  // Internal endpoint. Use updateTeam instead.
  updateTeamBrandingSettings: updateTeamBrandingSettingsRoute,
  updateTeamDocumentSettings: updateTeamDocumentSettingsRoute,

  findTeamInvoices: findTeamInvoicesRoute,
  getTeamPrices: getTeamPricesRoute,
  createTeamPendingCheckout: createTeamPendingCheckoutRoute,
  createBillingPortal: createBillingPortalRoute,
  findTeamsPending: findTeamsPendingRoute,
  deleteTeamPending: deleteTeamPendingRoute,
});
