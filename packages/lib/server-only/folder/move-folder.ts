import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';

export interface MoveFolderOptions {
  userId: number;
  teamId?: number;
  folderId?: string;
  parentId?: string | null;
  requestMetadata?: ApiRequestMetadata;
}

export const moveFolder = async ({ userId, teamId, folderId, parentId }: MoveFolderOptions) => {
  return await prisma.$transaction(async (tx) => {
    const folder = await tx.folder.findFirst({
      where: {
        id: folderId,
        team: buildTeamWhereQuery({
          teamId,
          userId,
        }),
      },
    });

    if (!folder) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Folder not found',
      });
    }

    if (parentId) {
      const parentFolder = await tx.folder.findFirst({
        where: {
          id: parentId,
          userId,
          teamId,
          type: folder.type,
        },
      });

      if (!parentFolder) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Parent folder not found',
        });
      }

      if (parentId === folderId) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Cannot move a folder into itself',
        });
      }

      let currentParentId = parentFolder.parentId;
      while (currentParentId) {
        if (currentParentId === folderId) {
          throw new AppError(AppErrorCode.INVALID_REQUEST, {
            message: 'Cannot move a folder into its descendant',
          });
        }

        const currentParent = await tx.folder.findUnique({
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

    return await tx.folder.update({
      where: {
        id: folderId,
      },
      data: {
        parentId,
      },
    });
  });
};
