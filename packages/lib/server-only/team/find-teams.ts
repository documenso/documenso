import type { Team } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import type { FindResultResponse } from '../../types/search-params';
import { getHighestTeamRoleInGroup } from '../../utils/teams';

export interface FindTeamsOptions {
  userId: number;
  organisationId: string;
  query?: string;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof Team;
    direction: 'asc' | 'desc';
  };
}

export const findTeams = async ({
  userId,
  organisationId,
  query,
  page = 1,
  perPage = 10,
  orderBy,
}: FindTeamsOptions) => {
  const orderByColumn = orderBy?.column ?? 'name';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const whereClause: Prisma.TeamWhereInput = {
    organisation: {
      id: organisationId,
    },
    teamGroups: {
      some: {
        organisationGroup: {
          organisationGroupMembers: {
            some: {
              organisationMember: {
                userId,
              },
            },
          },
        },
      },
    },
  };

  if (query && query.length > 0) {
    whereClause.name = {
      contains: query,
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
        teamGroups: {
          where: {
            organisationGroup: {
              organisationGroupMembers: {
                some: {
                  organisationMember: {
                    userId,
                  },
                },
              },
            },
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
    currentTeamRole: getHighestTeamRoleInGroup(team.teamGroups),
  }));

  return {
    data: maskedData,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof maskedData>;
};
