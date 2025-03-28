import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import type { DocumentVisibility } from '@documenso/prisma/generated/types';

export interface UpdateFolderOptions {
  userId: number;
  teamId?: number;
  folderId: string;
  name: string;
  visibility: DocumentVisibility;
}

export const updateFolder = async ({
  userId,
  teamId,
  folderId,
  name,
  visibility,
}: UpdateFolderOptions) => {
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
      name,
      visibility,
    },
  });
};
