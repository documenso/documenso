import { z } from 'zod';

import { declineTeamInvitation } from '@documenso/lib/server-only/team/decline-team-invitation';

import { authenticatedProcedure } from '../trpc';

export const ZDeclineTeamInvitationRequestSchema = z.object({
  teamId: z.number(),
});

export const declineTeamInvitationRoute = authenticatedProcedure
  .input(ZDeclineTeamInvitationRequestSchema)
  .mutation(async ({ input, ctx }) => {
    return await declineTeamInvitation({
      teamId: input.teamId,
      userId: ctx.user.id,
    });
  });
