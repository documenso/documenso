import type { FindResultSet } from '@documenso/lib/types/find-result-set';
import { prisma } from '@documenso/prisma';
import type { Team } from '@documenso/prisma/client';
import { Prisma } from '@documenso/prisma/client';

export interface FindTeamsOptions {
  userId: number;
  term?: string;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Team;
    direction: 'asc' | 'desc';
  };
}

export const findTeams = async ({
  userId,
  term,
  page = 1,
  perPage = 10,
  orderBy,
}: FindTeamsOptions) => {
  const orderByColumn = orderBy?.column ?? 'name';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const whereClause: Prisma.TeamWhereInput = {
    members: {
      some: {
        userId,
      },
    },
  };

  if (term && term.length > 0) {
    whereClause.name = {
      contains: term,
      mode: Prisma.QueryMode.insensitive,
    };
  }

  const [data, count] = await Promise.all([
    prisma.team.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
      include: {
        members: {
          where: {
            userId,
          },
        },
      },
    }),
    prisma.team.count({
      where: whereClause,
    }),
  ]);

  const maskedData = data.map((team) => ({
    ...team,
    currentTeamMember: team.members[0],
    members: undefined,
  }));

  return {
    data: maskedData,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultSet<typeof maskedData>;
};
