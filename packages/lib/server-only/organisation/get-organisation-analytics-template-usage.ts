import { prisma } from '@documenso/prisma';
import type {
  TGetOrganisationAnalyticsTemplateUsageRequest,
  TGetOrganisationAnalyticsTemplateUsageResponse,
} from '@documenso/trpc/server/organisation-router/get-organisation-analytics.types';
import { EnvelopeType } from '@prisma/client';

import { mapTemplateIdToSecondaryId } from '../../utils/envelope';
import { resolveTeamAnalyticsRange } from '../../utils/team-analytics-range';
import { getOrganisationAnalyticsScope } from './get-organisation-analytics-scope';

export type GetOrganisationAnalyticsTemplateUsageOptions = TGetOrganisationAnalyticsTemplateUsageRequest & {
  userId: number;
};

/**
 * Templates across the organisation ranked by how many documents were created from
 * them inside the requested window. Template metadata (including the owning team)
 * is null when the template has been deleted.
 */
export const getOrganisationAnalyticsTemplateUsage = async ({
  userId,
  organisationId,
  range,
  from,
  to,
  timezone,
  limit,
}: GetOrganisationAnalyticsTemplateUsageOptions): Promise<TGetOrganisationAnalyticsTemplateUsageResponse> => {
  const scope = await getOrganisationAnalyticsScope({ organisationId, userId });
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
      deletedAt: null,
      team: {
        organisationId: scope.organisationId,
      },
      secondaryId: {
        in: usage.map(({ templateId }) => mapTemplateIdToSecondaryId(templateId)),
      },
    },
    select: {
      id: true,
      secondaryId: true,
      title: true,
      updatedAt: true,
      team: {
        select: {
          id: true,
          name: true,
          url: true,
          avatarImageId: true,
        },
      },
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
        team: template?.team ?? null,
        count,
      };
    }),
  };
};
