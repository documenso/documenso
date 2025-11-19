import { acceptOrganisationInvitation } from '@doku-seal/lib/server-only/organisation/accept-organisation-invitation';

import { maybeAuthenticatedProcedure } from '../trpc';
import {
  ZAcceptOrganisationMemberInviteRequestSchema,
  ZAcceptOrganisationMemberInviteResponseSchema,
} from './accept-organisation-member-invite.types';

export const acceptOrganisationMemberInviteRoute = maybeAuthenticatedProcedure
  .input(ZAcceptOrganisationMemberInviteRequestSchema)
  .output(ZAcceptOrganisationMemberInviteResponseSchema)
  .mutation(async ({ input }) => {
    const { token } = input;

    return await acceptOrganisationInvitation({
      token,
    });
  });
