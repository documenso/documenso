import { EnvelopeType, SigningStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type GetCompletedFieldsForTokenOptions = {
  token: string;
};

// Note: You many need to filter this on a per envelope item ID basis.
export const getCompletedFieldsForToken = async ({ token }: GetCompletedFieldsForTokenOptions) => {
  return await prisma.field.findMany({
    where: {
      envelope: {
        type: EnvelopeType.DOCUMENT,
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
