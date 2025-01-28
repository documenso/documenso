import { prisma } from '@documenso/prisma';
import { SigningStatus } from '@documenso/prisma/client';

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
