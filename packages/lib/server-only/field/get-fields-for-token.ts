import { prisma } from '@documenso/prisma';
import { FieldType, RecipientRole } from '@documenso/prisma/client';

export type GetFieldsForTokenOptions = {
  token: string;
};

export const getFieldsForToken = async ({ token }: GetFieldsForTokenOptions) => {
  if (!token) {
    throw new Error('Missing token');
  }

  const recipient = await prisma.recipient.findFirst({
    where: { token },
  });

  if (!recipient) {
    return [];
  }

  if (recipient.role === RecipientRole.ASSISTANT) {
    return await prisma.field.findMany({
      where: {
        OR: [
          {
            type: {
              not: FieldType.SIGNATURE,
            },
            documentId: recipient.documentId,
          },
          {
            recipientId: recipient.id,
            documentId: recipient.documentId,
          },
        ],
      },
      include: {
        signature: true,
      },
    });
  }

  return await prisma.field.findMany({
    where: {
      recipientId: recipient.id,
    },
    include: {
      signature: true,
    },
  });
};
