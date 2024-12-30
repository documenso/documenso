import { z } from 'zod';

import { leaveTeam } from '@documenso/lib/server-only/team/leave-team';

import { authenticatedProcedure } from '../trpc';

export const ZLeaveTeamRequestSchema = z.object({
  teamId: z.number(),
});

export const leaveTeamRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/{teamId}/leave',
  //     summary: 'Leave a team',
  //     description: '',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZLeaveTeamRequestSchema)
  .output(z.unknown())
  .mutation(async ({ input, ctx }) => {
    return await leaveTeam({
      userId: ctx.user.id,
      ...input,
    });
  });
