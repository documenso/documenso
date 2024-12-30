import { z } from 'zod';

import { updateTeamMember } from '@documenso/lib/server-only/team/update-team-member';
import { TeamMemberRole } from '@documenso/prisma/client';

import { authenticatedProcedure } from '../trpc';

export const ZUpdateTeamMemberRequestSchema = z.object({
  teamId: z.number(),
  teamMemberId: z.number(),
  data: z.object({
    role: z.nativeEnum(TeamMemberRole),
  }),
});

export const updateTeamMemberRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/{teamId}/member/{teamMemberId}',
  //     summary: 'Update member',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZUpdateTeamMemberRequestSchema)
  .output(z.unknown())
  .mutation(async ({ input, ctx }) => {
    return await updateTeamMember({
      userId: ctx.user.id,
      ...input,
    });
  });
