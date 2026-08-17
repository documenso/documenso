import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export type UpdatePublicProfileOptions = {
  userId: number;
  teamId: number;
  data: {
    bio?: string;
    enabled?: boolean;
  };
};

export const updateTeamPublicProfile = async ({ userId, teamId, data }: UpdatePublicProfileOptions) => {
  return await prisma.team.update({
    where: buildTeamWhereQuery({
      teamId,
      userId,
      roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
    }),
    data: {
      profile: {
        upsert: {
          create: data,
          update: data,
        },
      },
    },
    include: {
      profile: true,
    },
  });
};
