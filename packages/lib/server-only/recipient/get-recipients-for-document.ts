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
      document: teamId
        ? {
            team: {
              id: teamId,
              members: {
                some: {
                  userId,
                },
              },
            },
          }
        : {
            userId,
            teamId: null,
          },
    },
    orderBy: {
      id: 'asc',
    },
  });

  return recipients;
};

export interface GetAllRecipientsByDocumentIdOptions {
  documentId: number;
}

export const getAllRecipientsByDocumentId = async ({
  documentId,
}: GetAllRecipientsByDocumentIdOptions) => {
  const recipients = await prisma.recipient.findMany({
    where: {
      documentId,
    },
    select: {
      role: true,
      signingStatus: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  return recipients;
};
