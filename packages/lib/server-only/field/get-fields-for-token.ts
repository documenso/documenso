import { prisma } from '@documenso/prisma';
import { RecipientRole } from '@documenso/prisma/client';

export type GetFieldsForTokenOptions = {
  token: string;
};

export const getFieldsForToken = async ({ token }: GetFieldsForTokenOptions) => {
  if (!token) {
    throw new Error('Missing token');
  }

  const recipient = await prisma.recipient.findFirst({
    where: { token },
    select: { role: true, documentId: true },
  });

  if (!recipient) {
    return [];
  }

  if (recipient.role === RecipientRole.ASSISTANT) {
    return await prisma.field.findMany({
      where: {
        type: {
          not: 'SIGNATURE',
        },
        Recipient: {
          documentId: recipient.documentId,
        },
      },
      include: {
        Signature: true,
      },
    });
  }

  return await prisma.field.findMany({
    where: {
      Recipient: {
        token,
      },
    },
    include: {
      Signature: true,
    },
  });
};
