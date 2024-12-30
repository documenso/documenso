import { z } from 'zod';

import { createTeam } from '@documenso/lib/server-only/team/create-team';

import { authenticatedProcedure } from '../trpc';
import { ZTeamNameSchema, ZTeamUrlSchema } from './schema';

export const ZCreateTeamRequestSchema = z.object({
  teamName: ZTeamNameSchema,
  teamUrl: ZTeamUrlSchema,
});

export const createTeamRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/create',
  //     summary: 'Create team',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZCreateTeamRequestSchema)
  .output(z.unknown())
  .mutation(async ({ input, ctx }) => {
    return await createTeam({
      userId: ctx.user.id,
      ...input,
    });
  });
