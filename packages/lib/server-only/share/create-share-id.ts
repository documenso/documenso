import { nanoid } from 'nanoid';

import { prisma } from '@documenso/prisma';

export interface CreateSharingIdOptions {
  documentId: number;
  recipientId: number;
}

export const createSharingId = async ({ documentId, recipientId }: CreateSharingIdOptions) => {
  const result = await prisma.share.create({
    data: {
      recipientId,
      documentId,
      link: nanoid(),
    },
  });

  return result;
};
