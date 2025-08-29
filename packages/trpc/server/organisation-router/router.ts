import { router } from '../trpc';
import { acceptOrganisationMemberInviteRoute } from './accept-organisation-member-invite';
import { createOrganisationRoute } from './create-organisation';
import { createOrganisationGroupRoute } from './create-organisation-group';
import { createOrganisationMemberInvitesRoute } from './create-organisation-member-invites';
import { declineOrganisationMemberInviteRoute } from './decline-organisation-member-invite';
import { deleteOrganisationRoute } from './delete-organisation';
import { deleteOrganisationGroupRoute } from './delete-organisation-group';
import { deleteOrganisationMemberRoute } from './delete-organisation-member';
import { deleteOrganisationMemberInvitesRoute } from './delete-organisation-member-invites';
import { deleteOrganisationMembersRoute } from './delete-organisation-members';
import { findOrganisationGroupsRoute } from './find-organisation-groups';
import { findOrganisationMemberInvitesRoute } from './find-organisation-member-invites';
import { findOrganisationMembersRoute } from './find-organisation-members';
import { getOrganisationRoute } from './get-organisation';
import { getOrganisationMemberInvitesRoute } from './get-organisation-member-invites';
import { getOrganisationSessionRoute } from './get-organisation-session';
import { getOrganisationsRoute } from './get-organisations';
import { leaveOrganisationRoute } from './leave-organisation';
import { resendOrganisationMemberInviteRoute } from './resend-organisation-member-invite';
import { updateOrganisationRoute } from './update-organisation';
import { updateOrganisationGroupRoute } from './update-organisation-group';
import { updateOrganisationMemberRoute } from './update-organisation-members';
import { updateOrganisationSettingsRoute } from './update-organisation-settings';

export const organisationRouter = router({
  get: getOrganisationRoute,
  getMany: getOrganisationsRoute,
  create: createOrganisationRoute,
  update: updateOrganisationRoute,
  delete: deleteOrganisationRoute,
  leave: leaveOrganisationRoute,
  member: {
    find: findOrganisationMembersRoute,
    update: updateOrganisationMemberRoute,
    delete: deleteOrganisationMemberRoute,
    deleteMany: deleteOrganisationMembersRoute,
    invite: {
      find: findOrganisationMemberInvitesRoute,
      getMany: getOrganisationMemberInvitesRoute,
      createMany: createOrganisationMemberInvitesRoute,
      deleteMany: deleteOrganisationMemberInvitesRoute,
      accept: acceptOrganisationMemberInviteRoute,
      decline: declineOrganisationMemberInviteRoute,
      resend: resendOrganisationMemberInviteRoute,
    },
  },
  group: {
    find: findOrganisationGroupsRoute,
    create: createOrganisationGroupRoute,
    update: updateOrganisationGroupRoute,
    delete: deleteOrganisationGroupRoute,
  },
  settings: {
    update: updateOrganisationSettingsRoute,
  },
  internal: {
    getOrganisationSession: getOrganisationSessionRoute,
  },
});
