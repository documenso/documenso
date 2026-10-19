import { prisma } from '@documenso/prisma';
import type {
  TGetOrganisationAnalyticsStatusBreakdownRequest,
  TGetOrganisationAnalyticsStatusBreakdownResponse,
} from '@documenso/trpc/server/organisation-router/get-organisation-analytics.types';
import { DocumentStatus } from '@prisma/client';

import { resolveTeamAnalyticsRange } from '../../utils/team-analytics-range';
import { getOrganisationAnalyticsScope } from './get-organisation-analytics-scope';

export type GetOrganisationAnalyticsStatusBreakdownOptions = TGetOrganisationAnalyticsStatusBreakdownRequest & {
  userId: number;
};

/**
 * Current status of every document created across the organisation inside the
 * requested window.
 */
export const getOrganisationAnalyticsStatusBreakdown = async ({
  userId,
  organisationId,
  range,
  from,
  to,
  timezone,
}: GetOrganisationAnalyticsStatusBreakdownOptions): Promise<TGetOrganisationAnalyticsStatusBreakdownResponse> => {
  const scope = await getOrganisationAnalyticsScope({ organisationId, userId });
  const resolvedRange = resolveTeamAnalyticsRange({ range, from, to, timezone });

  const { start, end } = resolvedRange;

  const groups = await prisma.envelope.groupBy({
    by: ['status'],
    where: {
      ...scope.envelopeWhere,
      createdAt: {
        gte: start,
        lt: end,
      },
    },
    _count: {
      _all: true,
    },
  });

  const counts: Record<DocumentStatus, number> = {
    [DocumentStatus.DRAFT]: 0,
    [DocumentStatus.PENDING]: 0,
    [DocumentStatus.COMPLETED]: 0,
    [DocumentStatus.REJECTED]: 0,
    [DocumentStatus.CANCELLED]: 0,
  };

  for (const group of groups) {
    counts[group.status] = group._count._all;
  }

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return {
    range: resolvedRange,
    total,
    draft: counts[DocumentStatus.DRAFT],
    pending: counts[DocumentStatus.PENDING],
    completed: counts[DocumentStatus.COMPLETED],
    rejected: counts[DocumentStatus.REJECTED],
    cancelled: counts[DocumentStatus.CANCELLED],
  };
};
