import { deleteTeam } from '@documenso/lib/server-only/team/delete-team';

import { authenticatedProcedure } from '../trpc';
import { ZDeleteTeamRequestSchema, ZDeleteTeamResponseSchema } from './delete-team.types';

export const deleteTeamRoute = authenticatedProcedure
  // .meta(deleteTeamMeta)
  .input(ZDeleteTeamRequestSchema)
  .output(ZDeleteTeamResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = input;
    const { user } = ctx;

    await deleteTeam({
      userId: user.id,
      teamId,
    });
  });
