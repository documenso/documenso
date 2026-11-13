import { prisma } from '@documenso/prisma';
import type {
  TGetTeamAnalyticsTemplateUsageRequest,
  TGetTeamAnalyticsTemplateUsageResponse,
} from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { EnvelopeType } from '@prisma/client';

import { mapTemplateIdToSecondaryId } from '../../utils/envelope';
import { resolveTeamAnalyticsRange } from '../../utils/team-analytics-range';
import { getTeamAnalyticsScope } from './get-team-analytics-scope';

export type GetTeamAnalyticsTemplateUsageOptions = TGetTeamAnalyticsTemplateUsageRequest & {
  userId: number;
  userEmail: string;
};

/**
 * Templates ranked by how many visible documents were created from them inside the
 * requested window. Template metadata is null when the template has been deleted or
 * is not visible to the caller.
 */
export const getTeamAnalyticsTemplateUsage = async ({
  userId,
  userEmail,
  teamId,
  range,
  from,
  to,
  timezone,
  limit,
}: GetTeamAnalyticsTemplateUsageOptions): Promise<TGetTeamAnalyticsTemplateUsageResponse> => {
  const scope = await getTeamAnalyticsScope({ teamId, userId, userEmail });
  const resolvedRange = resolveTeamAnalyticsRange({ range, from, to, timezone });

  const { start, end } = resolvedRange;

  const groups = await prisma.envelope.groupBy({
    by: ['templateId'],
    where: {
      ...scope.envelopeWhere,
      templateId: {
        not: null,
      },
      createdAt: {
        gte: start,
        lt: end,
      },
    },
    _count: {
      _all: true,
    },
    orderBy: [
      {
        _count: {
          templateId: 'desc',
        },
      },
      {
        templateId: 'asc',
      },
    ],
    take: limit,
  });

  const usage = groups.flatMap((group) => {
    if (group.templateId === null) {
      return [];
    }

    return [
      {
        templateId: group.templateId,
        count: group._count._all,
      },
    ];
  });

  if (usage.length === 0) {
    return {
      range: resolvedRange,
      templates: [],
    };
  }

  const templates = await prisma.envelope.findMany({
    where: {
      type: EnvelopeType.TEMPLATE,
      teamId: scope.teamId,
      deletedAt: null,
      secondaryId: {
        in: usage.map(({ templateId }) => mapTemplateIdToSecondaryId(templateId)),
      },
      OR: [{ visibility: { in: scope.allowedVisibilities } }, { userId }],
    },
    select: {
      id: true,
      secondaryId: true,
      title: true,
      updatedAt: true,
    },
  });

  const templatesBySecondaryId = new Map(templates.map((template) => [template.secondaryId, template]));

  return {
    range: resolvedRange,
    templates: usage.map(({ templateId, count }) => {
      const template = templatesBySecondaryId.get(mapTemplateIdToSecondaryId(templateId));

      return {
        id: templateId,
        envelopeId: template?.id ?? null,
        title: template?.title ?? null,
        updatedAt: template?.updatedAt ?? null,
        count,
      };
    }),
  };
};
