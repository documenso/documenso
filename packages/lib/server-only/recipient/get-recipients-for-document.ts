import { prisma } from '@documenso/prisma';

export interface GetRecipientsForDocumentOptions {
  documentId: number;
  userId: number;
}

export const getRecipientsForDocument = async ({
  documentId,
  userId,
}: GetRecipientsForDocumentOptions) => {
  const recipients = await prisma.recipient.findMany({
    where: {
      documentId,
      Document: {
        userId,
      },
    },
    orderBy: {
      id: 'asc',
    },
  });

  return recipients;
};
