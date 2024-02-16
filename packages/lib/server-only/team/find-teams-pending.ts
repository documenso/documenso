import { prisma } from '@documenso/prisma';
import type { Team } from '@documenso/prisma/client';
import { Prisma } from '@documenso/prisma/client';

export interface FindTeamsPendingOptions {
  userId: number;
  term?: string;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Team;
    direction: 'asc' | 'desc';
  };
}

export const findTeamsPending = async ({
  userId,
  term,
  page = 1,
  perPage = 10,
  orderBy,
}: FindTeamsPendingOptions) => {
  const orderByColumn = orderBy?.column ?? 'name';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const whereClause: Prisma.TeamPendingWhereInput = {
    ownerUserId: userId,
  };

  if (term && term.length > 0) {
    whereClause.name = {
      contains: term,
      mode: Prisma.QueryMode.insensitive,
    };
  }

  const [data, count] = await Promise.all([
    prisma.teamPending.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
    }),
    prisma.teamPending.count({
      where: whereClause,
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  };
};
