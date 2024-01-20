'use server';

import type { Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type UpdateDocumentOptions = {
  data: Prisma.DocumentUpdateInput;
  userId: number;
  documentId: number;
};

export const updateDocument = async ({ documentId, userId, data }: UpdateDocumentOptions) => {
  return await prisma.document.update({
    where: {
      id: documentId,
      userId,
    },
    data: {
      ...data,
    },
  });
};
