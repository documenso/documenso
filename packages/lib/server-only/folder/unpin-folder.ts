import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import type { TFolderType } from '../../types/folder-type';

export interface UnpinFolderOptions {
  userId: number;
  teamId?: number;
  folderId: string;
  type?: TFolderType;
}

export const unpinFolder = async ({ userId, teamId, folderId, type }: UnpinFolderOptions) => {
  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      userId,
      teamId,
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
      pinned: false,
    },
  });
};
