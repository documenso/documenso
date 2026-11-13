import { getTeamAnalyticsOverview } from '@documenso/lib/server-only/team/get-team-analytics-overview';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetTeamAnalyticsOverviewRequestSchema,
  ZGetTeamAnalyticsOverviewResponseSchema,
} from './get-team-analytics.types';

export const getTeamAnalyticsOverviewRoute = authenticatedProcedure
  .input(ZGetTeamAnalyticsOverviewRequestSchema)
  .output(ZGetTeamAnalyticsOverviewResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId, range, from, to, timezone } = input;

    ctx.logger.info({
      input: {
        teamId,
        range,
        from,
        to,
      },
    });

    return await getTeamAnalyticsOverview({
      teamId,
      range,
      from,
      to,
      timezone,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
    });
  });
