'use server';

import { prisma } from '@documenso/prisma';
import type { DocumentStatus } from '@documenso/prisma/client';

export type CreateDocumentOptions = {
  title: string;
  userId: number;
  documentDataId: string;
  status?: DocumentStatus;
};

export const createDocument = async ({
  userId,
  title,
  documentDataId,
  status,
}: CreateDocumentOptions) => {
  return await prisma.document.create({
    data: {
      title,
      documentDataId,
      userId,
      status,
    },
  });
};
