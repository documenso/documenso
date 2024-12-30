import { z } from 'zod';

import { createTeamEmailVerification } from '@documenso/lib/server-only/team/create-team-email-verification';

import { authenticatedProcedure } from '../trpc';

export const ZCreateTeamEmailVerificationRequestSchema = z.object({
  teamId: z.number(),
  name: z.string().trim().min(1, { message: 'Please enter a valid name.' }),
  email: z.string().trim().email().toLowerCase().min(1, 'Please enter a valid email.'),
});

export const createTeamEmailVerificationRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/{teamId}/email/create',
  //     summary: 'Create team email',
  //     description: 'Add an email to a team and send an email request to verify it',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZCreateTeamEmailVerificationRequestSchema)
  .mutation(async ({ input, ctx }) => {
    return await createTeamEmailVerification({
      teamId: input.teamId,
      userId: ctx.user.id,
      data: {
        email: input.email,
        name: input.name,
      },
    });
  });
