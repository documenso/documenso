import { getOrganisationAnalyticsTeamActivity } from '@documenso/lib/server-only/organisation/get-organisation-analytics-team-activity';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetOrganisationAnalyticsTeamActivityRequestSchema,
  ZGetOrganisationAnalyticsTeamActivityResponseSchema,
} from './get-organisation-analytics.types';

export const getOrganisationAnalyticsTeamActivityRoute = authenticatedProcedure
  .input(ZGetOrganisationAnalyticsTeamActivityRequestSchema)
  .output(ZGetOrganisationAnalyticsTeamActivityResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId, range, from, to, timezone } = input;

    ctx.logger.info({
      input: {
        organisationId,
        range,
        from,
        to,
      },
    });

    return await getOrganisationAnalyticsTeamActivity({
      organisationId,
      range,
      from,
      to,
      timezone,
      userId: ctx.user.id,
    });
  });
