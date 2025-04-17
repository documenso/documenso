import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { DocumentVisibility } from '@documenso/prisma/generated/types';

import type { TFolderType } from '../../types/folder-type';
import { FolderType } from '../../types/folder-type';

export interface UpdateFolderOptions {
  userId: number;
  teamId?: number;
  folderId: string;
  name: string;
  visibility: DocumentVisibility;
  type?: TFolderType;
}

export const updateFolder = async ({
  userId,
  teamId,
  folderId,
  name,
  visibility,
  type,
}: UpdateFolderOptions) => {
  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      userId,
      teamId,
      type,
    },
  });

  if (!folder) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Folder not found',
    });
  }

  const isTemplateFolder = folder.type === FolderType.TEMPLATE;
  const effectiveVisibility =
    isTemplateFolder && teamId !== null ? DocumentVisibility.EVERYONE : visibility;

  return await prisma.folder.update({
    where: {
      id: folderId,
    },
    data: {
      name,
      visibility: effectiveVisibility,
    },
  });
};
