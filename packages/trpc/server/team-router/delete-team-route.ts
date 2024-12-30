import { z } from 'zod';

import { deleteTeam } from '@documenso/lib/server-only/team/delete-team';

import { authenticatedProcedure } from '../trpc';

export const ZDeleteTeamRequestSchema = z.object({
  teamId: z.number(),
});

export const deleteTeamRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/{teamId}/delete',
  //     summary: 'Delete team',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZDeleteTeamRequestSchema)
  .output(z.unknown())
  .mutation(async ({ input, ctx }) => {
    return await deleteTeam({
      userId: ctx.user.id,
      ...input,
    });
  });
