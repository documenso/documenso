import { prisma } from '@documenso/prisma';

import { getDocumentWhereInput } from '../document/get-document-by-id';

export interface GetRecipientsForDocumentOptions {
  documentId: number;
  userId: number;
  teamId: number;
}

export const getRecipientsForDocument = async ({
  documentId,
  userId,
  teamId,
}: GetRecipientsForDocumentOptions) => {
  const { documentWhereInput } = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const recipients = await prisma.recipient.findMany({
    where: {
      document: documentWhereInput,
    },
    orderBy: {
      id: 'asc',
    },
  });

  return recipients;
};
