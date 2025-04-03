import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';

export interface DeleteFolderOptions {
  userId: number;
  teamId?: number;
  folderId: string;
  requestMetadata?: ApiRequestMetadata;
}

export const deleteFolder = async ({
  userId,
  teamId,
  folderId,
  requestMetadata,
}: DeleteFolderOptions) => {
  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      userId,
      teamId,
    },
    include: {
      documents: true,
      subfolders: true,
    },
  });

  if (!folder) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Folder not found',
    });
  }

  if (folder.documents.length > 0) {
    await prisma.document.deleteMany({
      where: {
        folderId,
      },
    });
  }

  if (folder.subfolders.length > 0) {
    await prisma.folder.deleteMany({
      where: {
        parentId: folderId,
      },
    });
  }

  return await prisma.folder.delete({
    where: {
      id: folderId,
    },
  });
};
