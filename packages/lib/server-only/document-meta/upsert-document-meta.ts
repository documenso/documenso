'use server';

import { prisma } from '@documenso/prisma';

export type CreateDocumentMetaOptions = {
  documentId: number;
  subject: string;
  message: string;
};

export const upsertDocumentMeta = async ({
  subject,
  message,
  documentId,
}: CreateDocumentMetaOptions) => {
  return await prisma.documentMeta.upsert({
    where: {
      documentId,
    },
    create: {
      subject,
      message,
      documentId,
    },
    update: {
      subject,
      message,
    },
  });
};
