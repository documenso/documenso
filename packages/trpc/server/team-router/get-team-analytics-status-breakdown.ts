import { getTeamAnalyticsStatusBreakdown } from '@documenso/lib/server-only/team/get-team-analytics-status-breakdown';

import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import {
  ZGetTeamAnalyticsStatusBreakdownRequestSchema,
  ZGetTeamAnalyticsStatusBreakdownResponseSchema,
} from './get-team-analytics.types';

export const getTeamAnalyticsStatusBreakdownRoute = authenticatedProcedure
  .input(ZGetTeamAnalyticsStatusBreakdownRequestSchema)
  .output(ZGetTeamAnalyticsStatusBreakdownResponseSchema)
  .use(twoFactorScope((input) => ({ team: input.teamId })))
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

    return await getTeamAnalyticsStatusBreakdown({
      teamId,
      range,
      from,
      to,
      timezone,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
    });
  });
