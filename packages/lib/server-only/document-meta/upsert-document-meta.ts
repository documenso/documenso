'use server';

import { prisma } from '@documenso/prisma';

export type CreateDocumentMetaOptions = {
  documentId: number;
  subject?: string;
  message?: string;
  timezone?: string;
  password?: string;
  dateFormat?: string;
  redirectUrl?: string;
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
  redirectUrl,
}: CreateDocumentMetaOptions) => {
  await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
      OR: [
        {
          userId,
        },
        {
          team: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
      ],
    },
  });

  return await prisma.documentMeta.upsert({
    where: {
      documentId,
    },
    create: {
      subject,
      message,
      password,
      dateFormat,
      timezone,
      documentId,
      redirectUrl,
    },
    update: {
      subject,
      message,
      password,
      dateFormat,
      timezone,
      redirectUrl,
    },
  });
};
