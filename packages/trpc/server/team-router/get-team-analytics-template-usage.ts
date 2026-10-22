import { getTeamAnalyticsTemplateUsage } from '@documenso/lib/server-only/team/get-team-analytics-template-usage';

import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import {
  ZGetTeamAnalyticsTemplateUsageRequestSchema,
  ZGetTeamAnalyticsTemplateUsageResponseSchema,
} from './get-team-analytics.types';

export const getTeamAnalyticsTemplateUsageRoute = authenticatedProcedure
  .input(ZGetTeamAnalyticsTemplateUsageRequestSchema)
  .output(ZGetTeamAnalyticsTemplateUsageResponseSchema)
  .use(twoFactorScope((input) => ({ team: input.teamId })))
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
