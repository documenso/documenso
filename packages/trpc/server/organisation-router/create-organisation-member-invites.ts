import { createOrganisationMemberInvites } from '@documenso/lib/server-only/organisation/create-organisation-member-invites';

import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import {
  ZCreateOrganisationMemberInvitesRequestSchema,
  ZCreateOrganisationMemberInvitesResponseSchema,
} from './create-organisation-member-invites.types';

export const createOrganisationMemberInvitesRoute = authenticatedProcedure
  .input(ZCreateOrganisationMemberInvitesRequestSchema)
  .output(ZCreateOrganisationMemberInvitesResponseSchema)
  .use(twoFactorScope((input) => ({ organisation: input.organisationId })))
  .mutation(async ({ ctx, input }) => {
    const { organisationId, invitations } = input;
    const userId = ctx.user.id;
    const userName = ctx.user.name || '';

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    await createOrganisationMemberInvites({
      userId,
      userName,
      organisationId,
      invitations,
    });
  });
