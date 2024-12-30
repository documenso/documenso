import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { updateTeamPublicProfile } from '@documenso/lib/server-only/team/update-team-public-profile';

import { ZUpdatePublicProfileRequestSchema } from '../profile-router/update-public-profile-route';
import { authenticatedProcedure } from '../trpc';

export const ZUpdateTeamPublicProfileRequestSchema = ZUpdatePublicProfileRequestSchema.pick({
  bio: true,
  enabled: true,
}).extend({
  teamId: z.number(),
});

export const updateTeamPublicProfileRoute = authenticatedProcedure
  // .meta({
  //   openapi: {
  //     method: 'POST',
  //     path: '/team/{teamId}/profile',
  //     summary: 'Update a team public profile',
  //     description: '',
  //     tags: ['Teams'],
  //   },
  // })
  .input(ZUpdateTeamPublicProfileRequestSchema)
  .output(z.unknown())
  .mutation(async ({ input, ctx }) => {
    try {
      const { teamId, bio, enabled } = input;

      await updateTeamPublicProfile({
        userId: ctx.user.id,
        teamId,
        data: {
          bio,
          enabled,
        },
      });
    } catch (err) {
      console.error(err);

      const error = AppError.parseError(err);

      if (error.code !== AppErrorCode.UNKNOWN_ERROR) {
        throw error;
      }

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'We were unable to update your public profile. Please review the information you provided and try again.',
      });
    }
  });
