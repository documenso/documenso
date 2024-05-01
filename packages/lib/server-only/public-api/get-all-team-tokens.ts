import { prisma } from '@documenso/prisma';
import { TeamMemberRole } from '@documenso/prisma/client';

export type GetUserTokensOptions = {
  userId: number;
  teamId: number;
};

export const getTeamTokens = async ({ userId, teamId }: GetUserTokensOptions) => {
  const teamMember = await prisma.teamMember.findFirst({
    where: {
      userId,
      teamId,
    },
  });

  if (teamMember?.role !== TeamMemberRole.ADMIN) {
    return {
      tokens: [],
      error: { message: 'You do not have the required permissions to view this page' },
    };
  }

  const tokens = await prisma.apiToken.findMany({
    where: {
      teamId,
    },
    select: {
      id: true,
      name: true,
      algorithm: true,
      createdAt: true,
      expires: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return { tokens, error: null };
};
