import { z } from 'zod';

import { updateTeam } from '@documenso/lib/server-only/team/update-team';

import { authenticatedProcedure } from '../trpc';
import { ZTeamNameSchema, ZTeamUrlSchema } from './schema';

export const ZUpdateTeamRequestSchema = z.object({
  teamId: z.number(),
  data: z.object({
    name: ZTeamNameSchema,
    url: ZTeamUrlSchema,
  }),
});

export const updateTeamRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/{teamId}',
  //     summary: 'Update team',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZUpdateTeamRequestSchema)
  .output(z.unknown())
  .mutation(async ({ input, ctx }) => {
    return await updateTeam({
      userId: ctx.user.id,
      ...input,
    });
  });
