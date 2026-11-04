import { getOrganisationAnalyticsOverview } from '@documenso/lib/server-only/organisation/get-organisation-analytics-overview';

import { authenticatedProcedure } from '../trpc';
import { twoFactorScope } from '../two-factor-enforcement/enforce';
import {
  ZGetOrganisationAnalyticsOverviewRequestSchema,
  ZGetOrganisationAnalyticsOverviewResponseSchema,
} from './get-organisation-analytics.types';

export const getOrganisationAnalyticsOverviewRoute = authenticatedProcedure
  .input(ZGetOrganisationAnalyticsOverviewRequestSchema)
  .output(ZGetOrganisationAnalyticsOverviewResponseSchema)
  .use(twoFactorScope((input) => ({ organisation: input.organisationId })))
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

    return await getOrganisationAnalyticsOverview({
      organisationId,
      range,
      from,
      to,
      timezone,
      userId: ctx.user.id,
    });
  });
