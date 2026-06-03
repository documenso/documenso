import { prisma } from '@documenso/prisma';

import type { TFolderType } from '../../types/folder-type';
import { buildFolderAccessFilter, getUserTeamGroupIds } from '../../utils/folder-access';
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
  const userGroupIds = await getUserTeamGroupIds(userId, teamId);

  const accessFilter = buildFolderAccessFilter(userId, team.currentTeamRole, userGroupIds);

  const whereClause = (folderId: string) => ({
    id: folderId,
    ...(type ? { type } : {}),
    OR: [
      { teamId, ...accessFilter },
      { userId, teamId },
    ],
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
