import { prisma } from '@documenso/prisma';
import { EnvelopeType } from '@prisma/client';

import { mapDocumentIdToSecondaryId } from '../../utils/envelope';
import { getNextDictatableRecipient } from '../../utils/recipient-groups';

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
    },
  });

  const nextRecipient = getNextDictatableRecipient({ recipients, currentRecipientId });

  if (!nextRecipient) {
    return null;
  }

  return {
    ...nextRecipient,
    token: '',
  };
};
