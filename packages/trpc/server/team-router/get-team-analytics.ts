import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { DEFAULT_ANALYTICS_PERIOD, resolveAnalyticsPeriod } from '@documenso/lib/server-only/team/analytics-period';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { getTeamAnalytics } from '@documenso/lib/server-only/team/get-team-analytics';
import { canExecuteTeamAction } from '@documenso/lib/utils/teams';

import { authenticatedProcedure } from '../trpc';
import { ZGetTeamAnalyticsRequestSchema, ZGetTeamAnalyticsResponseSchema } from './get-team-analytics.types';

export const getTeamAnalyticsRoute = authenticatedProcedure
  .input(ZGetTeamAnalyticsRequestSchema)
  .output(ZGetTeamAnalyticsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId, period, timezone, senderIds } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        teamId,
        period,
        senderIds,
      },
    });

    const team = await getTeamById({ userId: user.id, teamId });

    // Analytics are restricted to team admins and managers (MANAGE_TEAM).
    if (!canExecuteTeamAction('MANAGE_TEAM', team.currentTeamRole)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to view analytics for this team',
      });
    }

    const { start, end } = resolveAnalyticsPeriod({
      period: period ?? DEFAULT_ANALYTICS_PERIOD,
      timezone,
    });

    return await getTeamAnalytics({
      userId: user.id,
      teamId,
      periodStart: start,
      periodEnd: end,
      senderIds,
    });
  });
