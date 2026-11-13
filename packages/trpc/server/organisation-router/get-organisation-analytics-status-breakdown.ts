import { getOrganisationAnalyticsStatusBreakdown } from '@documenso/lib/server-only/organisation/get-organisation-analytics-status-breakdown';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetOrganisationAnalyticsStatusBreakdownRequestSchema,
  ZGetOrganisationAnalyticsStatusBreakdownResponseSchema,
} from './get-organisation-analytics.types';

export const getOrganisationAnalyticsStatusBreakdownRoute = authenticatedProcedure
  .input(ZGetOrganisationAnalyticsStatusBreakdownRequestSchema)
  .output(ZGetOrganisationAnalyticsStatusBreakdownResponseSchema)
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

    return await getOrganisationAnalyticsStatusBreakdown({
      organisationId,
      range,
      from,
      to,
      timezone,
      userId: ctx.user.id,
    });
  });
