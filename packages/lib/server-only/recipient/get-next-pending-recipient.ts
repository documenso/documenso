import { prisma } from '@documenso/prisma';

export const getNextPendingRecipient = async ({
  documentId,
  currentRecipientId,
}: {
  documentId: number;
  currentRecipientId: number;
}) => {
  const recipients = await prisma.recipient.findMany({
    where: {
      documentId,
    },
    orderBy: [
      {
        signingOrder: {
          sort: 'asc',
          nulls: 'last',
        },
      },
      {
        id: 'asc',
      },
    ],
  });

  const currentIndex = recipients.findIndex((r) => r.id === currentRecipientId);

  if (currentIndex === -1 || currentIndex === recipients.length - 1) {
    return null;
  }

  return {
    ...recipients[currentIndex + 1],
    token: '',
  };
};
