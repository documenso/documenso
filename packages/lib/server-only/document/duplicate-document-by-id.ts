import { prisma } from '@documenso/prisma';

export interface DuplicateDocumentByIdOptions {
  id: number;
  userId: number;
}

export const duplicateDocumentById = async ({ id, userId }: DuplicateDocumentByIdOptions) => {
  const document = await prisma.document.findUniqueOrThrow({
    where: {
      id,
      userId: userId,
    },
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
        },
      },
    },
  });

  const createdDocument = await prisma.document.create({
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
  });

  return createdDocument.id;
};
