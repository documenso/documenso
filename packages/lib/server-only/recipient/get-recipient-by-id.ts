import { prisma } from '@documenso/prisma';

export type GetRecipientByIdOptions = {
  id: number;
  documentId: number;
};

export const getRecipientById = async ({ documentId, id }: GetRecipientByIdOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      documentId,
      id,
    },
  });

  if (!recipient) {
    throw new Error('Recipient not found');
  }

  return recipient;
};
