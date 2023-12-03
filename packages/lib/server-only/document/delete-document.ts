'use server';

import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

import { sendDeletedEmail } from './send-delete-email';

export type DeleteDocumentOptions = {
  id: number;
  userId: number;
  status: string;
};

export const deleteDocument = async ({ id, userId, status }: DeleteDocumentOptions) => {
  if (status === DocumentStatus.DRAFT) {
    return await prisma.document.delete({ where: { id, userId, status: DocumentStatus.DRAFT } });
  }
  await sendDeletedEmail({ documentId: id, userId });
  return await prisma.document.update({
    where: {
      id,
    },
    data: {
      deletedAt: new Date(),
    },
  });
};
