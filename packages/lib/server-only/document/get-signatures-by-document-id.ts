import { prisma } from '@documenso/prisma';

export interface GetSignaturesByDocumentIdOptions {
  id: number;
}

export const getSignaturesByDocumentId = async ({ id }: GetSignaturesByDocumentIdOptions) => {
  return await prisma.signature.findMany({
    where: {
      Field: {
        documentId: id,
      },
    },
    include: {
      Recipient: {
        include: {
          Document: {
            include: {
              auditLogs: true,
            },
          },
        },
      },
      Field: true,
    },
  });
};
