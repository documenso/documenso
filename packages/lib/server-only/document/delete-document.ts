'use server';

import { prisma } from '@documenso/prisma';

export type DeleteDocumentOptions = {
  id: number;
  userId: number;
};

export const deleteDocument = async ({ id, userId }: DeleteDocumentOptions) => {
  return await prisma.document.delete({ where: { id, userId } });
};
