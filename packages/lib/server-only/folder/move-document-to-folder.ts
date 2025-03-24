import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';

export interface MoveDocumentToFolderOptions {
  userId: number;
  teamId?: number;
  documentId: string;
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
  // Check if the document exists and belongs to the user/team
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

  // If folderId is provided, check if the folder exists and belongs to the user/team
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

  // Move the document to the folder (or root if folderId is null)
  return await prisma.document.update({
    where: {
      id: documentId,
    },
    data: {
      folderId,
    },
  });
};
