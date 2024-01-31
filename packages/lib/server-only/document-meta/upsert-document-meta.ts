'use server';

import { prisma } from '@documenso/prisma';

export type CreateDocumentMetaOptions = {
  documentId: number;
  subject?: string;
  message?: string;
  timezone?: string;
  password?: string;
  dateFormat?: string;
  userId: number;
};

export const upsertDocumentMeta = async ({
  subject,
  message,
  timezone,
  dateFormat,
  documentId,
  userId,
  password,
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
      password,
      documentId,
    },
    update: {
      subject,
      message,
      dateFormat,
      password,
      timezone,
    },
  });
};
