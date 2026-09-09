import { IS_TEAM_ANALYTICS_ENABLED } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getTeamAnalytics } from '@documenso/lib/server-only/team/get-team-analytics';

import { authenticatedProcedure } from '../trpc';
import { ZGetTeamAnalyticsRequestSchema, ZGetTeamAnalyticsResponseSchema } from './get-team-analytics.types';

/** Authenticated team analytics query. */
export const getTeamAnalyticsRoute = authenticatedProcedure
  .input(ZGetTeamAnalyticsRequestSchema)
  .output(ZGetTeamAnalyticsResponseSchema)
  .query(async ({ input, ctx }) => {
    if (!IS_TEAM_ANALYTICS_ENABLED()) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Team analytics is disabled',
      });
    }

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
