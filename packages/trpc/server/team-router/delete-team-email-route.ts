import { z } from 'zod';

import { deleteTeamEmail } from '@documenso/lib/server-only/team/delete-team-email';

import { authenticatedProcedure } from '../trpc';

export const ZDeleteTeamEmailRequestSchema = z.object({
  teamId: z.number(),
});

export const deleteTeamEmailRequestRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/{teamId}/email/delete',
  //     summary: 'Delete team email',
  //     description: '',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZDeleteTeamEmailRequestSchema)
  .mutation(async ({ input, ctx }) => {
    return await deleteTeamEmail({
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      ...input,
    });
  });
