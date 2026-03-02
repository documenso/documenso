import { Prisma } from '@documenso/prisma/client';

import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { getHighestTeamRoleInGroup } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import { ZFindUserTeamsRequestSchema, ZFindUserTeamsResponseSchema } from './find-user-teams.types';

export const findUserTeamsRoute = adminProcedure
  .input(ZFindUserTeamsRequestSchema)
  .output(ZFindUserTeamsResponseSchema)
  .query(async ({ input }) => {
    const { userId, query, page, perPage } = input;

    return await findUserTeams({
      userId,
      query,
      page,
      perPage,
    });
  });

type FindUserTeamsOptions = {
  userId: number;
  query?: string;
  page?: number;
  perPage?: number;
};

const findUserTeams = async ({ userId, query, page = 1, perPage = 10 }: FindUserTeamsOptions) => {
  const whereClause: Prisma.TeamWhereInput = {
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
        createdAt: 'desc',
      },
      include: {
        organisation: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
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

  const mappedData = data.map((team) => ({
    id: team.id,
    name: team.name,
    url: team.url,
    createdAt: team.createdAt,
    teamRole: getHighestTeamRoleInGroup(team.teamGroups),
    organisation: team.organisation,
  }));

  return {
    data: mappedData,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultResponse<typeof mappedData>;
};
