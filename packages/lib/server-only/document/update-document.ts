'use server';

import { Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type UpdateDocumentOptions = {
  documentId: number;
  data: Prisma.DocumentUpdateInput;
};

export const updateDocument = async ({ documentId, data }: UpdateDocumentOptions) => {
  return await prisma.document.update({
    where: {
      id: documentId,
    },
    data: {
      ...data,
    },
  });
};
