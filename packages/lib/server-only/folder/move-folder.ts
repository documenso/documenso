import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';

export interface MoveFolderOptions {
  userId: number;
  teamId?: number;
  folderId: string;
  parentId: string | null;
  requestMetadata?: ApiRequestMetadata;
}

export const moveFolder = async ({
  userId,
  teamId,
  folderId,
  parentId,
  requestMetadata,
}: MoveFolderOptions) => {
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

  // Prevent moving a folder into itself or its descendants
  if (parentId) {
    // Check if the target parent folder exists and belongs to the user/team
    const parentFolder = await prisma.folder.findFirst({
      where: {
        id: parentId,
        userId,
        teamId,
      },
    });

    if (!parentFolder) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Parent folder not found',
      });
    }

    // Check if the target parent is the folder itself
    if (parentId === folderId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Cannot move a folder into itself',
      });
    }

    // Check if the target parent is a descendant of the folder
    let currentParentId = parentFolder.parentId;
    while (currentParentId) {
      if (currentParentId === folderId) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Cannot move a folder into its descendant',
        });
      }

      const currentParent = await prisma.folder.findUnique({
        where: {
          id: currentParentId,
        },
        select: {
          parentId: true,
        },
      });

      if (!currentParent) {
        break;
      }

      currentParentId = currentParent.parentId;
    }
  }

  // Move the folder
  return await prisma.folder.update({
    where: {
      id: folderId,
    },
    data: {
      parentId,
    },
  });
};
