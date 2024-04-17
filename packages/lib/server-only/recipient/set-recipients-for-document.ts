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

  const normalizedRecipients = recipients.map((recipient) => ({
    ...recipient,
    email: recipient.email.toLowerCase(),
  }));

  const existingRecipients = await prisma.recipient.findMany({
    where: {
      documentId,
    },
  });

  const removedRecipients = existingRecipients.filter(
    (existingRecipient) =>
      !normalizedRecipients.find(
        (recipient) =>
          recipient.id === existingRecipient.id || recipient.email === existingRecipient.email,
      ),
  );

  const linkedRecipients = normalizedRecipients
    .map((recipient) => {
      const existing = existingRecipients.find(
        (existingRecipient) =>
          existingRecipient.id === recipient.id || existingRecipient.email === recipient.email,
      );

      return {
        ...recipient,
        _persisted: existing,
      };
    })
    .filter((recipient) => {
      return (
        recipient._persisted?.sendStatus !== SendStatus.SENT &&
        recipient._persisted?.signingStatus !== SigningStatus.SIGNED
      );
    });

  const persistedRecipients = await prisma.$transaction(
    // Disabling as wrapping promises here causes type issues
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    linkedRecipients.map((recipient) =>
      prisma.recipient.upsert({
        where: {
          id: recipient._persisted?.id ?? -1,
          documentId,
        },
        update: {
          name: recipient.name,
          email: recipient.email,
          documentId,
        },
        create: {
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
