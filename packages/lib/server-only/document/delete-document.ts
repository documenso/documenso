'use server';

import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

export type DeleteDraftDocumentOptions = {
  id: number;
  userId: number;
  status: DocumentStatus;
};

export const deleteDocument = async ({ id, userId, status }: DeleteDraftDocumentOptions) => {
  if (status === DocumentStatus.DRAFT) {
    return await prisma.document.delete({ where: { id, userId, status: DocumentStatus.DRAFT } });
  }
  // If the document is not a draft, only soft-delete.
  return await prisma.document.update({
    where: { id, userId, status },
    data: {
      deletedAt: new Date().toISOString(),
    },
  });
};
