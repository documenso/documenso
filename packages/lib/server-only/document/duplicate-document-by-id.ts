import { prisma } from '@documenso/prisma';
import type { Prisma } from '@documenso/prisma/client';

import { getDocumentWhereInput } from './get-document-by-id';

export interface DuplicateDocumentByIdOptions {
  id: number;
  userId: number;
  teamId?: number;
}

export const duplicateDocumentById = async ({
  id,
  userId,
  teamId,
}: DuplicateDocumentByIdOptions) => {
  const documentWhereInput = await getDocumentWhereInput({
    documentId: id,
    userId,
    teamId,
  });

  const document = await prisma.document.findUniqueOrThrow({
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

  const createDocumentArguments: Prisma.DocumentCreateArgs = {
    data: {
      title: document.title,
      User: {
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

  return createdDocument.id;
};
