import { prisma } from '@documenso/prisma';
import { EnvelopeType, RecipientRole } from '@prisma/client';

import { mapDocumentIdToSecondaryId } from '../../utils/envelope';

export const getNextPendingRecipient = async ({
  documentId,
  currentRecipientId,
}: {
  documentId: number;
  currentRecipientId: number;
}) => {
  const recipients = await prisma.recipient.findMany({
    where: {
      envelope: {
        type: EnvelopeType.DOCUMENT,
        secondaryId: mapDocumentIdToSecondaryId(documentId),
      },
      // CC recipients are informational only and never take part in signing,
      // so they must never be offered as the next pending recipient.
      role: {
        not: RecipientRole.CC,
      },
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
