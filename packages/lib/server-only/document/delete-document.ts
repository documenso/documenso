'use server';

import { prisma } from '@documenso/prisma';

import { sendDeletedEmail } from './send-delete-email';

export type DeleteDocumentOptions = {
  id: number;
  userId: number;
};

export const deleteDocument = async ({ id, userId }: DeleteDocumentOptions) => {
  const documentId = id;
  await sendDeletedEmail({ documentId, userId });
  return await prisma.document.update({
    where: {
      id,
    },
    data: {
      deletedAt: new Date(),
    },
  });
};
