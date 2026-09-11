import { getTeamAnalytics } from '@documenso/lib/server-only/team/get-team-analytics';

import { authenticatedProcedure } from '../trpc';
import { ZGetTeamAnalyticsRequestSchema, ZGetTeamAnalyticsResponseSchema } from './get-team-analytics.types';

/** Authenticated team analytics query. */
export const getTeamAnalyticsRoute = authenticatedProcedure
  .input(ZGetTeamAnalyticsRequestSchema)
  .output(ZGetTeamAnalyticsResponseSchema)
  .query(async ({ input, ctx }) => {
    ctx.logger.info({
      input: {
        teamId: input.teamId,
        period: input.period,
        date: input.date,
        timezone: input.timezone,
      },
    });

    return await getTeamAnalytics({
      ...input,
      userId: ctx.user.id,
    });
  });
