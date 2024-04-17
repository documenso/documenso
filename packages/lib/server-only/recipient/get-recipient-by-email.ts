import { prisma } from '@documenso/prisma';

export type GetRecipientByEmailOptions = {
  documentId: number;
  email: string;
};

export const getRecipientByEmail = async ({ documentId, email }: GetRecipientByEmailOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      documentId,
      email: email.toLowerCase(),
    },
  });

  if (!recipient) {
    throw new Error('Recipient not found');
  }

  return recipient;
};
