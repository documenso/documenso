import { createOrganisationMemberInvites } from '@documenso/lib/server-only/organisation/create-organisation-member-invites';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateOrganisationMemberInvitesRequestSchema,
  ZCreateOrganisationMemberInvitesResponseSchema,
} from './create-organisation-member-invites.types';

export const createOrganisationMemberInvitesRoute = authenticatedProcedure
  .input(ZCreateOrganisationMemberInvitesRequestSchema)
  .output(ZCreateOrganisationMemberInvitesResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { organisationId, invitations } = input;
    const userId = ctx.user.id;
    const userName = ctx.user.name || '';

    await createOrganisationMemberInvites({
      userId,
      userName,
      organisationId,
      invitations,
    });
  });
