'use server';

import { prisma } from '@documenso/prisma';

export type CreateDocumentMetaOptions = {
  documentId: number;
  subject: string;
  message: string;
  timezone: string;
  dateFormat: string;
  userId: number;
};

export const upsertDocumentMeta = async ({
  subject,
  message,
  timezone,
  dateFormat,
  documentId,
  userId,
}: CreateDocumentMetaOptions) => {
  await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
      userId,
    },
  });

  return await prisma.documentMeta.upsert({
    where: {
      documentId,
    },
    create: {
      subject,
      message,
      dateFormat,
      timezone,
      documentId,
    },
    update: {
      subject,
      message,
      dateFormat,
      timezone,
    },
  });
};
