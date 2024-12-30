import { z } from 'zod';

import { findTeamMembers } from '@documenso/lib/server-only/team/find-team-members';
import { ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

import { authenticatedProcedure } from '../trpc';

export const ZFindTeamMembersRequestSchema = ZFindSearchParamsSchema.extend({
  teamId: z.number(),
});

export const findTeamMembersRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'GET',
  //     path: '/team/{teamId}/member/find',
  //     summary: 'Find members',
  //     description: 'Find team members based on a search criteria',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZFindTeamMembersRequestSchema)
  .output(z.unknown())
  .query(async ({ input, ctx }) => {
    return await findTeamMembers({
      userId: ctx.user.id,
      ...input,
    });
  });
