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
        },
      },
    },
  });
};
