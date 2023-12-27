import { prisma } from '@documenso/prisma';
import type { Prisma } from '@documenso/prisma/client';

export type GetTeamsOptions = {
  userId: number;
};
export type GetTeamsResponse = Awaited<ReturnType<typeof getTeams>>;

export const getTeams = async ({ userId }: GetTeamsOptions) => {
  const teams = await prisma.team.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      members: {
        where: {
          userId,
        },
        select: {
          role: true,
        },
      },
    },
  });

  return teams.map(({ members, ...team }) => ({
    ...team,
    currentTeamMember: members[0],
  }));
};

export type GetTeamByIdOptions = {
  userId?: number;
  teamId: number;
};

/**
 * Get a team given a teamId.
 *
 * Provide an optional userId to check that the user is a member of the team.
 */
export const getTeamById = async ({ userId, teamId }: GetTeamByIdOptions) => {
  const whereFilter: Prisma.TeamWhereUniqueInput = {
    id: teamId,
  };

  if (userId !== undefined) {
    whereFilter['members'] = {
      some: {
        userId,
      },
    };
  }

  return await prisma.team.findUniqueOrThrow({
    where: whereFilter,
    include: {
      teamEmail: true,
    },
  });
};

export type GetTeamByUrlOptions = {
  userId?: number;
  teamUrl: string;
};

/**
 * Get a team given a teamId.
 *
 * Provide an optional userId to check that the user is a member of the team.
 */
export const getTeamByUrl = async ({ userId, teamUrl }: GetTeamByUrlOptions) => {
  const whereFilter: Prisma.TeamWhereUniqueInput = {
    url: teamUrl,
  };

  if (userId !== undefined) {
    whereFilter['members'] = {
      some: {
        userId,
      },
    };
  }

  const result = await prisma.team.findUniqueOrThrow({
    where: whereFilter,
    include: {
      teamEmail: true,
      emailVerification: true,
      transferVerification: true,
      members: {
        where: {
          userId,
        },
        select: {
          role: true,
        },
      },
    },
  });

  const { members, ...team } = result;

  return {
    ...team,
    currentTeamMember: members[0],
  };
};
