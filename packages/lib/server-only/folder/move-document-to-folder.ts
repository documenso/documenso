import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';

export interface MoveDocumentToFolderOptions {
  userId: number;
  teamId?: number;
  documentId: number;
  folderId: string | null;
  requestMetadata?: ApiRequestMetadata;
}

export const moveDocumentToFolder = async ({
  userId,
  teamId,
  documentId,
  folderId,
  requestMetadata,
}: MoveDocumentToFolderOptions) => {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      userId,
      teamId,
    },
  });

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  if (folderId !== null) {
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
  }

  return await prisma.document.update({
    where: {
      id: documentId,
    },
    data: {
      folderId,
    },
  });
};
