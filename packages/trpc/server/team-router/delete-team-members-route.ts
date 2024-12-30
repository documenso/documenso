import { z } from 'zod';

import { deleteTeamMembers } from '@documenso/lib/server-only/team/delete-team-members';

import { authenticatedProcedure } from '../trpc';

export const ZDeleteTeamMembersRequestSchema = z.object({
  teamId: z.number(),
  teamMemberIds: z.array(z.number()),
});

export const deleteTeamMembersRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/{teamId}/member/delete',
  //     summary: 'Delete members',
  //     description: '',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZDeleteTeamMembersRequestSchema)
  .output(z.unknown())
  .mutation(async ({ input, ctx }) => {
    return await deleteTeamMembers({
      userId: ctx.user.id,
      ...input,
    });
  });
