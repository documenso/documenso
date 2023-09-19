import { prisma } from '@documenso/prisma';
import { SendStatus, SigningStatus } from '@documenso/prisma/client';

import { nanoid } from '../../universal/id';

export interface SetRecipientsForDocumentOptions {
  userId: number;
  documentId: number;
  recipients: {
    id?: number | null;
    email: string;
    name: string;
  }[];
}

export const setRecipientsForDocument = async ({
  userId,
  documentId,
  recipients,
}: SetRecipientsForDocumentOptions) => {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      userId,
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  const existingRecipients = await prisma.recipient.findMany({
    where: {
      documentId,
    },
  });

  const removedRecipients = existingRecipients.filter(
    (existingRecipient) =>
      !recipients.find(
        (recipient) =>
          recipient.id === existingRecipient.id || recipient.email === existingRecipient.email,
      ),
  );

  const linkedRecipients = recipients
    .map((recipient) => {
      const existing = existingRecipients.find(
        (existingRecipient) =>
          existingRecipient.id === recipient.id || existingRecipient.email === recipient.email,
      );

      return {
        ...recipient,
        ...existing,
      };
    })
    .filter((recipient) => {
      return (
        recipient.sendStatus !== SendStatus.SENT && recipient.signingStatus !== SigningStatus.SIGNED
      );
    });

  const persistedRecipients = await prisma.$transaction(
    linkedRecipients.map((recipient) =>
      recipient.id
        ? prisma.recipient.update({
            where: {
              id: recipient.id,
              documentId,
            },
            data: {
              name: recipient.name,
              email: recipient.email,
              documentId,
            },
          })
        : prisma.recipient.create({
            data: {
              name: recipient.name,
              email: recipient.email,
              token: nanoid(),
              documentId,
            },
          }),
    ),
  );

  if (removedRecipients.length > 0) {
    await prisma.recipient.deleteMany({
      where: {
        id: {
          in: removedRecipients.map((recipient) => recipient.id),
        },
      },
    });
  }

  return persistedRecipients;
};
