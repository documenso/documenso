import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

export interface GetFolderByIdOptions {
  userId: number;
  teamId?: number;
  folderId: string;
}

export const getFolderById = async ({ userId, teamId, folderId }: GetFolderByIdOptions) => {
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

  return folder;
};
