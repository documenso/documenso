import { getTeams } from '@documenso/lib/server-only/team/get-teams';

import { authenticatedProcedure } from '../trpc';

export const getTeamsRoute = authenticatedProcedure.query(async ({ ctx }) => {
  return await getTeams({ userId: ctx.user.id });
});
