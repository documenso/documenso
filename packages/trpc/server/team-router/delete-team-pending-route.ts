import { z } from 'zod';

import { deleteTeamPending } from '@documenso/lib/server-only/team/delete-team-pending';

import { authenticatedProcedure } from '../trpc';

export const ZDeleteTeamPendingRequestSchema = z.object({
  pendingTeamId: z.number(),
});

export const deleteTeamPendingRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/pending/{pendingTeamId}/delete',
  //     summary: 'Delete pending team',
  //     description: '',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZDeleteTeamPendingRequestSchema)
  .mutation(async ({ input, ctx }) => {
    return await deleteTeamPending({
      userId: ctx.user.id,
      ...input,
    });
  });
