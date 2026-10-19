import { getOrganisationAnalyticsDocumentsOverTime } from '@documenso/lib/server-only/organisation/get-organisation-analytics-documents-over-time';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetOrganisationAnalyticsDocumentsOverTimeRequestSchema,
  ZGetOrganisationAnalyticsDocumentsOverTimeResponseSchema,
} from './get-organisation-analytics.types';

export const getOrganisationAnalyticsDocumentsOverTimeRoute = authenticatedProcedure
  .input(ZGetOrganisationAnalyticsDocumentsOverTimeRequestSchema)
  .output(ZGetOrganisationAnalyticsDocumentsOverTimeResponseSchema)
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

    return await getOrganisationAnalyticsDocumentsOverTime({
      organisationId,
      range,
      from,
      to,
      timezone,
      userId: ctx.user.id,
    });
  });
