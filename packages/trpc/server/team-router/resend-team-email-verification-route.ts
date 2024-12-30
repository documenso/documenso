import { z } from 'zod';

import { resendTeamEmailVerification } from '@documenso/lib/server-only/team/resend-team-email-verification';

import { authenticatedProcedure } from '../trpc';

export const ZResendTeamEmailVerificationRequestSchema = z.object({
  teamId: z.number(),
});

export const resendTeamEmailVerificationRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/{teamId}/email/resend',
  //     summary: 'Resend team email verification',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZResendTeamEmailVerificationRequestSchema)
  .mutation(async ({ input, ctx }) => {
    await resendTeamEmailVerification({
      userId: ctx.user.id,
      ...input,
    });
  });
