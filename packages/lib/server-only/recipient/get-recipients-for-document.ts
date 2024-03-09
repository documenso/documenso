import { prisma } from '@documenso/prisma';

export interface GetRecipientsForDocumentOptions {
  documentId: number;
  userId: number;
  teamId?: number;
}

export const getRecipientsForDocument = async ({
  documentId,
  userId,
  teamId,
}: GetRecipientsForDocumentOptions) => {
  const recipients = await prisma.recipient.findMany({
    where: {
      documentId,
      Document: {
        OR: [
          {
            userId,
          },
          {
            teamId,
            team: {
              members: {
                some: {
                  userId,
                },
              },
            },
          },
        ],
      },
    },
    orderBy: {
      id: 'asc',
    },
  });

  return recipients;
};
