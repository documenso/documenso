import { TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';

import { DocumentVisibility } from '../../types/document-visibility';
import type { TFolderType } from '../../types/folder-type';

export interface GetFolderBreadcrumbsOptions {
  userId: number;
  teamId?: number;
  folderId: string;
  type?: TFolderType;
}

export const getFolderBreadcrumbs = async ({
  userId,
  teamId,
  folderId,
  type,
}: GetFolderBreadcrumbsOptions) => {
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
      console.error('Error finding team:', error);
      return [];
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

  const whereClause = (folderId: string) => ({
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
  });

  const breadcrumbs = [];
  let currentFolderId = folderId;

  const currentFolder = await prisma.folder.findFirst({
    where: whereClause(currentFolderId),
  });

  if (!currentFolder) {
    return [];
  }

  breadcrumbs.push(currentFolder);

  while (currentFolder?.parentId) {
    const parentFolder = await prisma.folder.findFirst({
      where: whereClause(currentFolder.parentId),
    });

    if (!parentFolder) {
      break;
    }

    breadcrumbs.unshift(parentFolder);
    currentFolderId = parentFolder.id;
    currentFolder.parentId = parentFolder.parentId;
  }

  return breadcrumbs;
};
