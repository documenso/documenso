import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getDocumentWhereInput } from './get-document-by-id';

export type GetDocumentWithDetailsByIdOptions = {
  documentId: number;
  userId: number;
  teamId?: number;
  folderId?: string;
};

export const getDocumentWithDetailsById = async ({
  documentId,
  userId,
  teamId,
  folderId,
}: GetDocumentWithDetailsByIdOptions) => {
  const documentWhereInput = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const document = await prisma.document.findFirst({
    where: {
      ...documentWhereInput,
      folderId,
    },
    include: {
      documentData: true,
      documentMeta: true,
      recipients: true,
      fields: true,
      folder: true,
    },
  });

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  return document;
};
