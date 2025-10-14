import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery, canAccessTeamDocument } from '../../utils/teams';
import { getTeamById } from '../team/get-team';

export interface DeleteFolderOptions {
  userId: number;
  teamId: number;
  folderId: string;
}

export const deleteFolder = async ({ userId, teamId, folderId }: DeleteFolderOptions) => {
  const team = await getTeamById({ userId, teamId });

  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      team: buildTeamWhereQuery({
        teamId,
        userId,
      }),
    },
  });

  if (!folder) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Folder not found',
    });
  }

  const hasPermission = canAccessTeamDocument(team.currentTeamRole, folder.visibility);

  if (!hasPermission) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to delete this folder',
    });
  }

  return await prisma.folder.delete({
    where: {
      id: folderId,
    },
  });
};
