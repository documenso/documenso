import { prisma } from '@doku-seal/prisma';

export type GetRecipientSignaturesOptions = {
  recipientId: number;
};

export const getRecipientSignatures = async ({ recipientId }: GetRecipientSignaturesOptions) => {
  return await prisma.signature.findMany({
    where: {
      field: {
        recipientId,
      },
    },
  });
};
