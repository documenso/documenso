import { prisma } from '@documenso/prisma';
import type { Prisma } from '@prisma/client';
import type { FindResultResponse } from '../../types/search-params';
import type { TTagType } from '../../types/tag-type';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getTeamById } from '../team/get-team';

export type FindTagsOptions = {
  userId: number;
  teamId: number;
  type?: TTagType;
  query?: string;
  page?: number;
  perPage?: number;
};

export const findTags = async ({ userId, teamId, type, query, page = 1, perPage = 10 }: FindTagsOptions) => {
  await getTeamById({ userId, teamId });

  const whereClause: Prisma.TagWhereInput = {
    team: buildTeamWhereQuery({ teamId, userId }),
    type,
    name: query ? { contains: query, mode: 'insensitive' } : undefined,
  };

  const [data, count] = await Promise.all([
    prisma.tag.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.tag.count({
      where: whereClause,
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
