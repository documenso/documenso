import { prisma } from '@documenso/prisma';

export type GetRecipientSignaturesOptions = {
  recipientId: number;
};

export const getRecipientSignatures = async ({ recipientId }: GetRecipientSignaturesOptions) => {
  return await prisma.signature.findMany({
    where: {
      Field: {
        recipientId,
      },
    },
  });
};
