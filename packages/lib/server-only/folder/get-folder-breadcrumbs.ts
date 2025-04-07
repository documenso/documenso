import { prisma } from '@documenso/prisma';

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
  const breadcrumbs = [];
  let currentFolderId = folderId;

  // Fetch the current folder first
  const currentFolder = await prisma.folder.findFirst({
    where: {
      id: currentFolderId,
      userId,
      teamId,
      ...(type ? { type } : {}),
    },
  });

  if (!currentFolder) {
    return [];
  }

  breadcrumbs.push(currentFolder);

  // Fetch parent folders recursively
  while (currentFolder?.parentId) {
    const parentFolder = await prisma.folder.findFirst({
      where: {
        id: currentFolder.parentId,
        userId,
        teamId,
        ...(type ? { type } : {}),
      },
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
