'use server';

import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

export type DeleteDraftDocumentOptions = {
  id: number;
  userId: number;
};

export const deleteDraftDocument = async ({ id, userId }: DeleteDraftDocumentOptions) => {
  return await prisma.document.delete({ where: { id, userId, status: DocumentStatus.DRAFT } });
};
