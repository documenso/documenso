import { prisma } from '@documenso/prisma';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { buildTeamWhereQuery } from '../../utils/teams';

export type GetApiTokensOptions = {
  userId: number;
  teamId: number;
};

export const getApiTokens = async ({ userId, teamId }: GetApiTokensOptions) => {
  return await prisma.apiToken.findMany({
    where: {
      userId,
      team: buildTeamWhereQuery(teamId, userId, TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM']),
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
