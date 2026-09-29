import { getTeamAnalyticsTemplateUsage } from '@documenso/lib/server-only/team/get-team-analytics-template-usage';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetTeamAnalyticsTemplateUsageRequestSchema,
  ZGetTeamAnalyticsTemplateUsageResponseSchema,
} from './get-team-analytics.types';

export const getTeamAnalyticsTemplateUsageRoute = authenticatedProcedure
  .input(ZGetTeamAnalyticsTemplateUsageRequestSchema)
  .output(ZGetTeamAnalyticsTemplateUsageResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId, range, from, to, timezone, limit } = input;

    ctx.logger.info({
      input: {
        teamId,
        range,
        from,
        to,
        limit,
      },
    });

    return await getTeamAnalyticsTemplateUsage({
      teamId,
      range,
      from,
      to,
      timezone,
      limit,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
    });
  });
