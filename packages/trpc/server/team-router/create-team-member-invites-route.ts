import { z } from 'zod';

import { createTeamMemberInvites } from '@documenso/lib/server-only/team/create-team-member-invites';
import { TeamMemberRole } from '@documenso/prisma/client';

import { authenticatedProcedure } from '../trpc';

export const ZCreateTeamMemberInvitesRequestSchema = z.object({
  teamId: z.number(),
  invitations: z.array(
    z.object({
      email: z.string().email().toLowerCase(),
      role: z.nativeEnum(TeamMemberRole),
    }),
  ),
});

export const createTeamMemberInvitesRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/{teamId}/member/invite',
  //     summary: 'Invite members',
  //     description: 'Send email invitations to users to join the team',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZCreateTeamMemberInvitesRequestSchema)
  .output(z.unknown())
  .mutation(async ({ input, ctx }) => {
    return await createTeamMemberInvites({
      userId: ctx.user.id,
      userName: ctx.user.name ?? '',
      ...input,
    });
  });
