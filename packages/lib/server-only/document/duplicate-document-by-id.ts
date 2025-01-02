import { DocumentSource, type Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getDocumentWhereInput } from './get-document-by-id';

export interface DuplicateDocumentOptions {
  documentId: number;
  userId: number;
  teamId?: number;
}

export const duplicateDocument = async ({
  documentId,
  userId,
  teamId,
}: DuplicateDocumentOptions) => {
  const documentWhereInput = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const document = await prisma.document.findFirst({
    where: documentWhereInput,
    select: {
      title: true,
      userId: true,
      documentData: {
        select: {
          data: true,
          initialData: true,
          type: true,
        },
      },
      documentMeta: {
        select: {
          message: true,
          subject: true,
          dateFormat: true,
          password: true,
          timezone: true,
          redirectUrl: true,
        },
      },
    },
  });

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const createDocumentArguments: Prisma.DocumentCreateArgs = {
    data: {
      title: document.title,
      user: {
        connect: {
          id: document.userId,
        },
      },
      documentData: {
        create: {
          ...document.documentData,
          data: document.documentData.initialData,
        },
      },
      documentMeta: {
        create: {
          ...document.documentMeta,
        },
      },
      source: DocumentSource.DOCUMENT,
    },
  };

  if (teamId !== undefined) {
    createDocumentArguments.data.team = {
      connect: {
        id: teamId,
      },
    };
  }

  const createdDocument = await prisma.document.create(createDocumentArguments);

  return {
    documentId: createdDocument.id,
  };
};
