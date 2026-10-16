import { prisma } from '@documenso/prisma';
import type { TemplateType } from '@prisma/client';
import { EnvelopeType, type Prisma } from '@prisma/client';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import type { FindResultResponse } from '../../types/search-params';
import { getMemberRoles } from '../team/get-member-roles';
import { buildTemplateSearchFilter } from './build-template-search-filter';

export type FindTemplatesOptions = {
  userId: number;
  teamId: number;
  type?: TemplateType;
  page?: number;
  perPage?: number;
  folderId?: string;
  query?: string;
  ownerIds?: number[];
};

export const findTemplates = async ({
  userId,
  teamId,
  type,
  page = 1,
  perPage = 10,
  folderId,
  query,
  ownerIds,
}: FindTemplatesOptions) => {
  const { teamRole } = await getMemberRoles({
    teamId,
    reference: {
      type: 'User',
      id: userId,
    },
  });

  const filters: Prisma.EnvelopeWhereInput[] = [
    { teamId },
    {
      OR: [
        {
          visibility: {
            in: TEAM_DOCUMENT_VISIBILITY_MAP[teamRole],
          },
        },
        { userId, teamId },
      ],
    },
    folderId ? { folderId } : { folderId: null },
  ];

  if (ownerIds && ownerIds.length > 0) {
    filters.push({ userId: { in: ownerIds } });
  }

  const searchFilter = buildTemplateSearchFilter(query);

  if (searchFilter) {
    filters.push(searchFilter);
  }

  const where: Prisma.EnvelopeWhereInput = {
    type: EnvelopeType.TEMPLATE,
    templateType: type,
    AND: filters,
  };

  const templateInclude = {
    team: {
      select: {
        id: true,
        url: true,
        name: true,
      },
    },
    fields: true,
    recipients: true,
    documentMeta: true,
    directLink: {
      select: {
        token: true,
        enabled: true,
      },
    },
  } as const;

  const [data, count] = await Promise.all([
    prisma.envelope.findMany({
      where,
      include: templateInclude,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.envelope.count({ where }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
