'use server';

import { prisma } from '@documenso/prisma';

export type UpdateTitleOptions = {
  userId?: number;
  documentId: number;
  title: string;
};

export const updateTitle = async ({ documentId, title }: UpdateTitleOptions) => {
  return await prisma.document.update({
    where: {
      id: documentId,
    },
    data: {
      title: title,
    },
  });
};
