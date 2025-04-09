import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { FolderType } from '@documenso/lib/types/folder-type';
import { prisma } from '@documenso/prisma';

export interface MoveTemplateToFolderOptions {
  userId: number;
  teamId?: number;
  templateId: number;
  folderId?: string;
}

export const moveTemplateToFolder = async ({
  userId,
  teamId,
  templateId,
  folderId,
}: MoveTemplateToFolderOptions) => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      userId,
      teamId,
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  if (folderId !== null) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
        teamId,
        type: FolderType.TEMPLATE,
      },
    });

    if (!folder) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Folder not found',
      });
    }
  }

  return await prisma.template.update({
    where: {
      id: templateId,
    },
    data: {
      folderId,
    },
  });
};
