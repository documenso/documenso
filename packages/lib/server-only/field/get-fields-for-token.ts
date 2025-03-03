import { FieldType, RecipientRole, SigningStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

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
            recipient: {
              signingStatus: {
                not: SigningStatus.SIGNED,
              },
              signingOrder: {
                gte: recipient.signingOrder ?? 0,
              },
            },
            documentId: recipient.documentId,
          },
          {
            recipientId: recipient.id,
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
