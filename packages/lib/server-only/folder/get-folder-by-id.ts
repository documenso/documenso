import { TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { DocumentVisibility } from '../../types/document-visibility';
import type { TFolderType } from '../../types/folder-type';

export interface GetFolderByIdOptions {
  userId: number;
  teamId?: number;
  folderId?: string;
  type?: TFolderType;
}

export const getFolderById = async ({ userId, teamId, folderId, type }: GetFolderByIdOptions) => {
  let teamMemberRole = null;

  if (teamId !== undefined) {
    try {
      const team = await prisma.team.findFirstOrThrow({
        where: {
          id: teamId,
          members: {
            some: {
              userId,
            },
          },
        },
        include: {
          members: {
            where: {
              userId,
            },
            select: {
              role: true,
            },
          },
        },
      });

      teamMemberRole = team.members[0].role;
    } catch (error) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Team not found',
      });
    }
  }

  const visibilityFilters = match(teamMemberRole)
    .with(TeamMemberRole.ADMIN, () => ({
      visibility: {
        in: [
          DocumentVisibility.EVERYONE,
          DocumentVisibility.MANAGER_AND_ABOVE,
          DocumentVisibility.ADMIN,
        ],
      },
    }))
    .with(TeamMemberRole.MANAGER, () => ({
      visibility: {
        in: [DocumentVisibility.EVERYONE, DocumentVisibility.MANAGER_AND_ABOVE],
      },
    }))
    .otherwise(() => ({ visibility: DocumentVisibility.EVERYONE }));

  const whereClause = {
    id: folderId,
    ...(type ? { type } : {}),
    ...(teamId
      ? {
          OR: [
            { teamId, ...visibilityFilters },
            { userId, teamId },
          ],
        }
      : { userId, teamId: null }),
  };

  const folder = await prisma.folder.findFirst({
    where: whereClause,
  });

  if (!folder) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Folder not found',
    });
  }

  return folder;
};
