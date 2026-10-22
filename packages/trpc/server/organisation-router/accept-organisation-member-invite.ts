import { acceptOrganisationInvitation } from '@documenso/lib/server-only/organisation/accept-organisation-invitation';

import { maybeAuthenticatedProcedure } from '../trpc';
import { twoFactorRemediation } from '../two-factor-enforcement/enforce';
import {
  ZAcceptOrganisationMemberInviteRequestSchema,
  ZAcceptOrganisationMemberInviteResponseSchema,
} from './accept-organisation-member-invite.types';

export const acceptOrganisationMemberInviteRoute = maybeAuthenticatedProcedure
  .input(ZAcceptOrganisationMemberInviteRequestSchema)
  .output(ZAcceptOrganisationMemberInviteResponseSchema)
  // Joining is never blocked, only access is.
  .use(twoFactorRemediation())
  .mutation(async ({ input }) => {
    const { token } = input;

    return await acceptOrganisationInvitation({
      token,
    });
  });
