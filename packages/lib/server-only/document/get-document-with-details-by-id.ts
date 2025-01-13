import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getDocumentWhereInput } from './get-document-by-id';

export type GetDocumentWithDetailsByIdOptions = {
  documentId: number;
  userId: number;
  teamId?: number;
};

export const getDocumentWithDetailsById = async ({
  documentId,
  userId,
  teamId,
}: GetDocumentWithDetailsByIdOptions) => {
  const documentWhereInput = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const document = await prisma.document.findFirst({
    where: documentWhereInput,
    include: {
      documentData: true,
      documentMeta: true,
      recipients: true,
      fields: true,
    },
  });

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  return document;
};
