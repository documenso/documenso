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
  // 2FA enforcement: REMEDIATION — joining is never blocked, access is; a blocked user must be able to accept an invite (org grace starts at join). Instance assert still applies.
  .use(twoFactorRemediation())
  .mutation(async ({ input }) => {
    const { token } = input;

    return await acceptOrganisationInvitation({
      token,
    });
  });
