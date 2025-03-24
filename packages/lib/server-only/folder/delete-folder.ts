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

  // Move documents to parent folder
  if (folder.documents.length > 0) {
    await prisma.document.updateMany({
      where: {
        folderId,
      },
      data: {
        folderId: folder.parentId,
      },
    });
  }

  // Move subfolders to parent folder
  if (folder.subfolders.length > 0) {
    await prisma.folder.updateMany({
      where: {
        parentId: folderId,
      },
      data: {
        parentId: folder.parentId,
      },
    });
  }

  // Delete the folder
  return await prisma.folder.delete({
    where: {
      id: folderId,
    },
  });
};
