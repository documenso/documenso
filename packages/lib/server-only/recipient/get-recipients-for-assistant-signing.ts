import { prisma } from '@documenso/prisma';
import { FieldType } from '@documenso/prisma/client';

export interface GetRecipientsForAssistantSigningOptions {
  documentId: number;
  userId: number;
  teamId?: number;
}

export const getRecipientsForAssistantSigning = async ({
  documentId,
  userId,
  teamId,
}: GetRecipientsForAssistantSigningOptions) => {
  // TODO: check for the fields that are being returned

  const recipients = await prisma.recipient.findMany({
    where: {
      documentId,
      document: {
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
    include: {
      fields: {
        where: {
          NOT: {
            type: FieldType.SIGNATURE,
          },
        },
      },
    },
  });

  return recipients;
};
