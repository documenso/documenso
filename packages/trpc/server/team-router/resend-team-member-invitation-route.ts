import { z } from 'zod';

import { resendTeamMemberInvitation } from '@documenso/lib/server-only/team/resend-team-member-invitation';

import { authenticatedProcedure } from '../trpc';

export const ZResendTeamMemberInvitationRequestSchema = z.object({
  teamId: z.number(),
  invitationId: z.number(),
});

export const resendTeamMemberInvitationRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/{teamId}/member/invite/{invitationId}/resend',
  //     summary: 'Resend member invite',
  //     description: 'Resend an email invitation to a user to join the team',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZResendTeamMemberInvitationRequestSchema)
  .output(z.unknown())
  .mutation(async ({ input, ctx }) => {
    await resendTeamMemberInvitation({
      userId: ctx.user.id,
      userName: ctx.user.name ?? '',
      ...input,
    });
  });
