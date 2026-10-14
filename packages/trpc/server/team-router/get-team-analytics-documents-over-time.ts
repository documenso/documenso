import { getTeamAnalyticsDocumentsOverTime } from '@documenso/lib/server-only/team/get-team-analytics-documents-over-time';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetTeamAnalyticsDocumentsOverTimeRequestSchema,
  ZGetTeamAnalyticsDocumentsOverTimeResponseSchema,
} from './get-team-analytics.types';

export const getTeamAnalyticsDocumentsOverTimeRoute = authenticatedProcedure
  .input(ZGetTeamAnalyticsDocumentsOverTimeRequestSchema)
  .output(ZGetTeamAnalyticsDocumentsOverTimeResponseSchema)
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

    return await getTeamAnalyticsDocumentsOverTime({
      teamId,
      range,
      from,
      to,
      timezone,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
    });
  });
