import { updateTeam } from '@documenso/lib/server-only/team/update-team';

import { authenticatedProcedure } from '../trpc';
import { ZUpdateTeamRequestSchema, ZUpdateTeamResponseSchema } from './update-team.types';

export const updateTeamRoute = authenticatedProcedure
  //   .meta(updateTeamMeta)
  .input(ZUpdateTeamRequestSchema)
  .output(ZUpdateTeamResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, data } = input;

    await updateTeam({
      userId: ctx.user.id,
      teamId,
      data,
    });
  });
