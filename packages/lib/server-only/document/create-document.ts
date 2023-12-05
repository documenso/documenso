'use server';

import { prisma } from '@documenso/prisma';

export type CreateDocumentOptions = {
  title: string;
  userId: number;
  documentDataId: string;
  documentThumbnailId?: number;
};

export const createDocument = async ({
  userId,
  title,
  documentDataId,
  documentThumbnailId,
}: CreateDocumentOptions) => {
  return await prisma.document.create({
    data: {
      title,
      documentDataId,
      userId,
      documentThumbnailId,
    },
  });
};
