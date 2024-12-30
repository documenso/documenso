import { z } from 'zod';

import { updateTeamEmail } from '@documenso/lib/server-only/team/update-team-email';

import { authenticatedProcedure } from '../trpc';

export const ZUpdateTeamEmailRequestSchema = z.object({
  teamId: z.number(),
  data: z.object({
    name: z.string().trim().min(1),
  }),
});

export const updateTeamEmailRequestRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/{teamId}/email',
  //     summary: 'Update a team email',
  //     description: '',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZUpdateTeamEmailRequestSchema)
  .mutation(async ({ input, ctx }) => {
    return await updateTeamEmail({
      userId: ctx.user.id,
      ...input,
    });
  });
