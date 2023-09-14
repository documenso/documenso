'use server';

import { prisma } from '@documenso/prisma';

export type CreateDocumentOptions = {
  title: string;
  userId: number;
  documentDataId: string;
};

export const createDocument = async ({ userId, title, documentDataId }: CreateDocumentOptions) => {
  return await prisma.document.create({
    data: {
      title,
      documentDataId,
      userId,
    },
  });
};
