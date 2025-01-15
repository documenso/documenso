import { prisma } from '@documenso/prisma';
import { FieldType, RecipientRole } from '@documenso/prisma/client';

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
      role: RecipientRole.SIGNER,

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
    include: {
      Field: {
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
