import { getTeamPrices } from '@documenso/ee/server-only/stripe/get-team-prices';

import { authenticatedProcedure } from '../trpc';

export const getTeamPricesRoute = authenticatedProcedure.query(async () => {
  return await getTeamPrices();
});
