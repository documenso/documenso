import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import type { TFolderType } from '../../types/folder-type';
import { buildTeamWhereQuery } from '../../utils/teams';

export interface PinFolderOptions {
  userId: number;
  teamId?: number;
  folderId: string;
  type?: TFolderType;
}

export const pinFolder = async ({ userId, teamId, folderId, type }: PinFolderOptions) => {
  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      team: buildTeamWhereQuery({
        teamId,
        userId,
      }),
      type,
    },
  });

  if (!folder) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Folder not found',
    });
  }

  return await prisma.folder.update({
    where: {
      id: folderId,
    },
    data: {
      pinned: true,
    },
  });
};
