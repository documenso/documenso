import { getOrganisationAnalyticsTemplateUsage } from '@documenso/lib/server-only/organisation/get-organisation-analytics-template-usage';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetOrganisationAnalyticsTemplateUsageRequestSchema,
  ZGetOrganisationAnalyticsTemplateUsageResponseSchema,
} from './get-organisation-analytics.types';

export const getOrganisationAnalyticsTemplateUsageRoute = authenticatedProcedure
  .input(ZGetOrganisationAnalyticsTemplateUsageRequestSchema)
  .output(ZGetOrganisationAnalyticsTemplateUsageResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId, range, from, to, timezone, limit } = input;

    ctx.logger.info({
      input: {
        organisationId,
        range,
        from,
        to,
        limit,
      },
    });

    return await getOrganisationAnalyticsTemplateUsage({
      organisationId,
      range,
      from,
      to,
      timezone,
      limit,
      userId: ctx.user.id,
    });
  });
