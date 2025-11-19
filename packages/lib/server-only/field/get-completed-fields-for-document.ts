import { SigningStatus } from '@prisma/client';

import { prisma } from '@doku-seal/prisma';

export type GetCompletedFieldsForDocumentOptions = {
  documentId: number;
};

export const getCompletedFieldsForDocument = async ({
  documentId,
}: GetCompletedFieldsForDocumentOptions) => {
  return await prisma.field.findMany({
    where: {
      documentId,
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
        },
      },
    },
  });
};
