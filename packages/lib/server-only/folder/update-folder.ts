import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';

export interface UpdateFolderOptions {
  userId: number;
  teamId?: number;
  folderId: string;
  name: string;
  requestMetadata?: ApiRequestMetadata;
}

export const updateFolder = async ({
  userId,
  teamId,
  folderId,
  name,
  requestMetadata,
}: UpdateFolderOptions) => {
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

  return await prisma.folder.update({
    where: {
      id: folderId,
    },
    data: {
      name,
    },
  });
};
