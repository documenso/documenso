import { prisma } from '@documenso/prisma';
import { SigningStatus } from '@documenso/prisma/client';

export type GetPendingFieldsForDocumentOptions = {
  documentId: number;
};

export const getPendingFieldsForDocument = async ({
  documentId,
}: GetPendingFieldsForDocumentOptions) => {
  const a = await prisma.field.findMany({
    where: {
      documentId,
      Recipient: {
        signingStatus: SigningStatus.NOT_SIGNED,
      },
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

  console.log(a);

  return a;
};
