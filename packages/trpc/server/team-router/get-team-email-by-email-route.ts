import { getTeamEmailByEmail } from '@documenso/lib/server-only/team/get-team-email-by-email';

import { authenticatedProcedure } from '../trpc';

export const getTeamEmailByEmailRoute = authenticatedProcedure.query(async ({ ctx }) => {
  return await getTeamEmailByEmail({ email: ctx.user.email });
});
