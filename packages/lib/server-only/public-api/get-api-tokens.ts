import { TeamMemberRole } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type GetApiTokensOptions = {
  userId: number;
  teamId: number;
};

export const getApiTokens = async ({ userId, teamId }: GetApiTokensOptions) => {
  return await prisma.apiToken.findMany({
    where: {
      userId,
      // Todo: Orgs check that this was how it originally works (admin required)
      team: buildTeamWhereQuery(teamId, userId, [TeamMemberRole.ADMIN]),
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
