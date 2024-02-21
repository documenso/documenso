import { prisma } from '@documenso/prisma';
import { SendStatus } from '@documenso/prisma/client';

export type DeleteRecipientOptions = {
  documentId: number;
  recipientId: number;
};

export const deleteRecipient = async ({ documentId, recipientId }: DeleteRecipientOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      id: recipientId,
      documentId,
    },
  });

  if (!recipient) {
    throw new Error('Recipient not found');
  }

  if (recipient.sendStatus !== SendStatus.NOT_SENT) {
    throw new Error('Can not delete a recipient that has already been sent a document');
  }

  const deletedRecipient = await prisma.recipient.delete({
    where: {
      id: recipient.id,
    },
  });

  return deletedRecipient;
};
