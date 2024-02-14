import { prisma } from '@documenso/prisma';
import type { Prisma } from '@documenso/prisma/client';

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

  const result = await prisma.team.findUniqueOrThrow({
    where: whereFilter,
    include: {
      teamEmail: true,
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
    currentTeamMember: userId !== undefined ? members[0] : null,
  };
};

export type GetTeamByUrlOptions = {
  userId: number;
  teamUrl: string;
};

/**
 * Get a team given a team URL.
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
      emailVerification: {
        select: {
          expiresAt: true,
          name: true,
          email: true,
        },
      },
      transferVerification: {
        select: {
          expiresAt: true,
          name: true,
          email: true,
        },
      },
      subscription: true,
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
