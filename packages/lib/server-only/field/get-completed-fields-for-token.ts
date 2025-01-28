import { prisma } from '@documenso/prisma';
import { SigningStatus } from '@documenso/prisma/client';

export type GetCompletedFieldsForTokenOptions = {
  token: string;
};

export const getCompletedFieldsForToken = async ({ token }: GetCompletedFieldsForTokenOptions) => {
  return await prisma.field.findMany({
    where: {
      document: {
        recipients: {
          some: {
            token,
          },
        },
      },
      recipient: {
        signingStatus: SigningStatus.SIGNED,
      },
      inserted: true,
    },
    include: {
      signature: true,
      recipient: {
        select: {
          name: true,
          email: true,
          signingStatus: true,
        },
      },
    },
  });
};
