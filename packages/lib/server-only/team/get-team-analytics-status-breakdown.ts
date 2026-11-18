import { prisma } from '@documenso/prisma';
import type {
  TGetTeamAnalyticsStatusBreakdownRequest,
  TGetTeamAnalyticsStatusBreakdownResponse,
} from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { DocumentStatus } from '@prisma/client';

import { resolveTeamAnalyticsRange } from '../../utils/team-analytics-range';
import { getTeamAnalyticsScope } from './get-team-analytics-scope';

export type GetTeamAnalyticsStatusBreakdownOptions = TGetTeamAnalyticsStatusBreakdownRequest & {
  userId: number;
  userEmail: string;
};

/**
 * Current status of every visible document created inside the requested window.
 */
export const getTeamAnalyticsStatusBreakdown = async ({
  userId,
  userEmail,
  teamId,
  range,
  from,
  to,
  timezone,
}: GetTeamAnalyticsStatusBreakdownOptions): Promise<TGetTeamAnalyticsStatusBreakdownResponse> => {
  const scope = await getTeamAnalyticsScope({ teamId, userId, userEmail });
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
