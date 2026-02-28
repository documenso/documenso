import type { TemplateType } from '@prisma/client';
import { EnvelopeType, type Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { TEAM_DOCUMENT_VISIBILITY_MAP } from '../../constants/teams';
import { type FindResultResponse } from '../../types/search-params';
import { getMemberRoles } from '../team/get-member-roles';

export type FindTemplatesOptions = {
  userId: number;
  teamId: number;
  type?: TemplateType;
  page?: number;
  perPage?: number;
  folderId?: string;
  query?: string;
};

export const findTemplates = async ({
  userId,
  teamId,
  type,
  page = 1,
  perPage = 10,
  folderId,
  query = '',
}: FindTemplatesOptions) => {
  const whereFilter: Prisma.EnvelopeWhereInput[] = [];

  const { teamRole } = await getMemberRoles({
    teamId,
    reference: {
      type: 'User',
      id: userId,
    },
  });

  const searchFilter: Prisma.EnvelopeWhereInput = {
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { externalId: { contains: query, mode: 'insensitive' } },
      { recipients: { some: { name: { contains: query, mode: 'insensitive' } } } },
      { recipients: { some: { email: { contains: query, mode: 'insensitive' } } } },
    ],
  };

  whereFilter.push(
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
    searchFilter,
  );

  if (folderId) {
    whereFilter.push({ folderId });
  } else {
    whereFilter.push({ folderId: null });
  }

  const [data, count] = await Promise.all([
    prisma.envelope.findMany({
      where: {
        type: EnvelopeType.TEMPLATE,
        templateType: type,
        AND: whereFilter,
      },
      include: {
        team: {
          select: {
            id: true,
            url: true,
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
      },
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.envelope.count({
      where: {
        type: EnvelopeType.TEMPLATE,
        templateType: type,
        AND: whereFilter,
      },
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof data>;
};
