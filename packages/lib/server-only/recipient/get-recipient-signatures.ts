import { prisma } from '@documenso/prisma';
import { FieldType } from '@prisma/client';

export type GetRecipientSignaturesOptions = {
  recipientId: number;
};

export const getRecipientSignatures = async ({ recipientId }: GetRecipientSignaturesOptions) => {
  return await prisma.signature.findMany({
    where: {
      field: {
        recipientId,
        type: {
          in: [FieldType.SIGNATURE, FieldType.FREE_SIGNATURE],
        },
      },
    },
    orderBy: {
      created: 'desc',
    },
  });
};
