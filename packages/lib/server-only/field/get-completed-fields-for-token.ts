import { EnvelopeType, SigningStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type GetCompletedFieldsForTokenOptions = {
  token: string;
};

// Todo: Envelopes - This needs to be redone since we need to determine which document to show the fields on.
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
