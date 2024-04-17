import { prisma } from '@documenso/prisma';

export interface GetRecipientsForDocumentOptions {
  documentId: number;
  userId: number;
<<<<<<< HEAD
=======
  teamId?: number;
>>>>>>> main
}

export const getRecipientsForDocument = async ({
  documentId,
  userId,
<<<<<<< HEAD
=======
  teamId,
>>>>>>> main
}: GetRecipientsForDocumentOptions) => {
  const recipients = await prisma.recipient.findMany({
    where: {
      documentId,
      Document: {
<<<<<<< HEAD
        userId,
=======
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
>>>>>>> main
      },
    },
    orderBy: {
      id: 'asc',
    },
  });

  return recipients;
};
