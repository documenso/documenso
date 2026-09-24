import { getTeamAnalyticsMemberActivity } from '@documenso/lib/server-only/team/get-team-analytics-member-activity';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetTeamAnalyticsMemberActivityRequestSchema,
  ZGetTeamAnalyticsMemberActivityResponseSchema,
} from './get-team-analytics.types';

export const getTeamAnalyticsMemberActivityRoute = authenticatedProcedure
  .input(ZGetTeamAnalyticsMemberActivityRequestSchema)
  .output(ZGetTeamAnalyticsMemberActivityResponseSchema)
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

    return await getTeamAnalyticsMemberActivity({
      teamId,
      range,
      from,
      to,
      timezone,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
    });
  });
