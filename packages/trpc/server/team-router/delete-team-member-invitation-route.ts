import { z } from 'zod';

import { deleteTeamMemberInvitations } from '@documenso/lib/server-only/team/delete-team-invitations';

import { authenticatedProcedure } from '../trpc';

export const ZDeleteTeamMemberInvitationsRequestSchema = z.object({
  teamId: z.number(),
  invitationIds: z.array(z.number()),
});

export const deleteTeamMemberInvitationRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/{teamId}/member/invite/delete',
  //     summary: 'Delete member invite',
  //     description: 'Delete a pending team member invite',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZDeleteTeamMemberInvitationsRequestSchema)
  .output(z.unknown())
  .mutation(async ({ input, ctx }) => {
    return await deleteTeamMemberInvitations({
      userId: ctx.user.id,
      ...input,
    });
  });
