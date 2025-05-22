import { prisma } from '@documenso/prisma';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';

export type UpdateTeamEmailOptions = {
  userId: number;
  teamId: number;
  data: {
    name: string;
  };
};

export const updateTeamEmail = async ({
  userId,
  teamId,
  data,
}: UpdateTeamEmailOptions): Promise<void> => {
  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery(teamId, userId, TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM']),
    include: {
      teamEmail: true,
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  if (!team.teamEmail) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team email does not exist',
    });
  }

  await prisma.teamEmail.update({
    where: {
      teamId,
    },
    data: {
      // Note: Never allow the email to be updated without re-verifying via email.
      name: data.name,
    },
  });
};
