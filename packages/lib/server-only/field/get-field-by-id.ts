import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery } from '../../utils/teams';

export type GetFieldByIdOptions = {
  userId: number;
  teamId: number;
  fieldId: number;
};

export const getFieldById = async ({ userId, teamId, fieldId }: GetFieldByIdOptions) => {
  const field = await prisma.field.findFirst({
    where: {
      id: fieldId,
    },
    include: {
      document: {
        select: {
          teamId: true,
        },
      },
      template: {
        select: {
          teamId: true,
        },
      },
    },
  });

  const foundTeamId = field?.document?.teamId || field?.template?.teamId;

  if (!field || !foundTeamId || foundTeamId !== teamId) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Field not found',
    });
  }

  const team = await prisma.team.findUnique({
    where: buildTeamWhereQuery({
      teamId: foundTeamId,
      userId,
    }),
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Field not found',
    });
  }

  return field;
};
