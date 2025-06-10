import { DocumentVisibility, TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

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
      userId,
      teamId,
    },
    include: {
      documents: true,
      subfolders: true,
      templates: true,
    },
  });

  if (!folder) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Folder not found',
    });
  }

  const hasPermission = match(team.currentTeamRole)
    .with(TeamMemberRole.ADMIN, () => true)
    .with(TeamMemberRole.MANAGER, () => folder.visibility !== DocumentVisibility.ADMIN)
    .with(TeamMemberRole.MEMBER, () => folder.visibility === DocumentVisibility.EVERYONE)
    .otherwise(() => false);

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
