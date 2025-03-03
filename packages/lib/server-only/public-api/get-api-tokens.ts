import { TeamMemberRole } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type GetApiTokensOptions = {
  userId: number;
  teamId?: number;
};

export const getApiTokens = async ({ userId, teamId }: GetApiTokensOptions) => {
  return await prisma.apiToken.findMany({
    where: {
      ...(teamId
        ? {
            team: {
              id: teamId,
              members: {
                some: {
                  userId,
                  role: TeamMemberRole.ADMIN,
                },
              },
            },
          }
        : {
            userId,
            teamId: null,
          }),
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      expires: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};
