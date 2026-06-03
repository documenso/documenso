import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import type { DocumentVisibility } from '@documenso/prisma/generated/types';

import { buildFolderAccessFilter, getUserTeamGroupIds } from '../../utils/folder-access';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getTeamById } from '../team/get-team';

export interface UpdateFolderOptions {
  userId: number;
  teamId: number;
  folderId: string;
  data: {
    parentId?: string | null;
    name?: string;
    visibility?: DocumentVisibility;
    pinned?: boolean;
    allowedUserIds?: number[];
    allowedGroupIds?: string[];
  };
}

export const updateFolder = async ({ userId, teamId, folderId, data }: UpdateFolderOptions) => {
  const { parentId, name, visibility, pinned, allowedUserIds, allowedGroupIds } = data;

  const team = await getTeamById({ userId, teamId });
  const userGroupIds = await getUserTeamGroupIds(userId, teamId);

  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      team: buildTeamWhereQuery({
        teamId,
        userId,
      }),
      ...buildFolderAccessFilter(userId, team.currentTeamRole, userGroupIds),
    },
  });

  if (!folder) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Folder not found',
    });
  }

  if (parentId) {
    const parentFolder = await prisma.folder.findFirst({
      where: {
        id: parentId,
        team: buildTeamWhereQuery({ teamId, userId }),
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

  return await prisma.folder.update({
    where: {
      id: folderId,
      team: buildTeamWhereQuery({
        teamId,
        userId,
      }),
    },
    data: {
      name,
      visibility,
      parentId,
      pinned,
      ...(allowedUserIds !== undefined ? { allowedUserIds } : {}),
      ...(allowedGroupIds !== undefined ? { allowedGroupIds } : {}),
    },
  });
};
