'use server';

import { prisma } from '@documenso/prisma';

export type DeleteDraftDocumentOptions = {
  id: number;
  userId: number;
};

export const deleteDraftDocument = async ({ id, userId }: DeleteDraftDocumentOptions) => {
  return await prisma.document.delete({ where: { id, userId, status: 'DRAFT' } });
};
