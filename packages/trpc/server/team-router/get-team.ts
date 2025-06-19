import { getTeam } from '@documenso/lib/server-only/team/get-team';

import { authenticatedProcedure } from '../trpc';
import { ZGetTeamRequestSchema, ZGetTeamResponseSchema } from './get-team.types';

export const getTeamRoute = authenticatedProcedure
  //   .meta(getTeamMeta)
  .input(ZGetTeamRequestSchema)
  .output(ZGetTeamResponseSchema)
  .query(async ({ input, ctx }) => {
    return await getTeam({
      teamReference: input.teamReference,
      userId: ctx.user.id,
    });
  });
