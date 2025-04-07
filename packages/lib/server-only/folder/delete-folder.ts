import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

export interface DeleteFolderOptions {
  userId: number;
  teamId?: number;
  folderId: string;
}

export const deleteFolder = async ({ userId, teamId, folderId }: DeleteFolderOptions) => {
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

  return await prisma.folder.delete({
    where: {
      id: folderId,
    },
  });
};
