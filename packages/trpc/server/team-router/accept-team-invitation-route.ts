import { z } from 'zod';

import { acceptTeamInvitation } from '@documenso/lib/server-only/team/accept-team-invitation';

import { authenticatedProcedure } from '../trpc';

export const ZAcceptTeamInvitationRequestSchema = z.object({
  teamId: z.number(),
});

export const acceptTeamInvitationRoute = authenticatedProcedure
  .input(ZAcceptTeamInvitationRequestSchema)
  .mutation(async ({ input, ctx }) => {
    return await acceptTeamInvitation({
      teamId: input.teamId,
      userId: ctx.user.id,
    });
  });
