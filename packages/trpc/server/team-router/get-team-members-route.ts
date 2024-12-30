import { z } from 'zod';

import { getTeamMembers } from '@documenso/lib/server-only/team/get-team-members';

import { authenticatedProcedure } from '../trpc';

export const ZGetTeamMembersRequestSchema = z.object({
  teamId: z.number(),
});

export const getTeamMembersRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'GET',
  //     path: '/team/{teamId}/member',
  //     summary: 'Get members',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZGetTeamMembersRequestSchema)
  .output(z.unknown())
  .query(async ({ input, ctx }) => {
    return await getTeamMembers({ teamId: input.teamId, userId: ctx.user.id });
  });
