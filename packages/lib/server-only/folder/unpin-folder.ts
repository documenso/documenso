import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

export interface UnpinFolderOptions {
  userId: number;
  teamId?: number;
  folderId: string;
}

export const unpinFolder = async ({ userId, teamId, folderId }: UnpinFolderOptions) => {
  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      userId,
      teamId,
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
