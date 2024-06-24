import { prisma } from '@documenso/prisma';
import { SigningStatus } from '@documenso/prisma/client';

export type GetCompletedFieldsForTokenOptions = {
  token: string;
};

export const getCompletedFieldsForToken = async ({ token }: GetCompletedFieldsForTokenOptions) => {
  return await prisma.field.findMany({
    where: {
      Document: {
        Recipient: {
          some: {
            token,
          },
        },
      },
      Recipient: {
        signingStatus: SigningStatus.SIGNED,
      },
      inserted: true,
    },
    include: {
      Signature: true,
      Recipient: {
        select: {
          name: true,
          email: true,
          signingStatus: true,
        },
      },
    },
  });
};
