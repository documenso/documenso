import { prisma } from '@documenso/prisma';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';

export type DeleteTokenByIdOptions = {
  id: number;
  userId: number;
  teamId: number;
};

export const deleteTokenById = async ({ id, userId, teamId }: DeleteTokenByIdOptions) => {
  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery(teamId, userId, TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM']),
  });

  if (!team) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to delete this token',
    });
  }

  return await prisma.apiToken.delete({
    where: {
      id,
      teamId,
    },
  });
};
