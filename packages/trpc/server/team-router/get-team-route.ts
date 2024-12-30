import { z } from 'zod';

import { getTeamById } from '@documenso/lib/server-only/team/get-team';

import { authenticatedProcedure } from '../trpc';

export const ZGetTeamRequestSchema = z.object({
  teamId: z.number(),
});

export const getTeamRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'GET',
  //     path: '/team/{teamId}',
  //     summary: 'Get team',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZGetTeamRequestSchema)
  .output(z.unknown())
  .query(async ({ input, ctx }) => {
    return await getTeamById({ teamId: input.teamId, userId: ctx.user.id });
  });
