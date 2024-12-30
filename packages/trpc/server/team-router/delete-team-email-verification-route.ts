import { z } from 'zod';

import { deleteTeamEmailVerification } from '@documenso/lib/server-only/team/delete-team-email-verification';

import { authenticatedProcedure } from '../trpc';

export const ZDeleteTeamEmailVerificationRequestSchema = z.object({
  teamId: z.number(),
});

export const deleteTeamEmailVerificationRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/{teamId}/email/verify/delete',
  //     summary: 'Delete team email verification',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZDeleteTeamEmailVerificationRequestSchema)
  .mutation(async ({ input, ctx }) => {
    return await deleteTeamEmailVerification({
      userId: ctx.user.id,
      ...input,
    });
  });
