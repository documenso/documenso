import { TeamMemberRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';

import { DocumentVisibility } from '../../types/document-visibility';
import type { TFolderType } from '../../types/folder-type';
import { getTeamById } from '../team/get-team';

export interface GetFolderBreadcrumbsOptions {
  userId: number;
  teamId: number;
  folderId: string;
  type?: TFolderType;
}

export const getFolderBreadcrumbs = async ({
  userId,
  teamId,
  folderId,
  type,
}: GetFolderBreadcrumbsOptions) => {
  const team = await getTeamById({ userId, teamId });

  const visibilityFilters = match(team.currentTeamRole)
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
