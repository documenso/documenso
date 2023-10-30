import { prisma } from '@documenso/prisma';

import { nanoid } from '../../universal/id';

export interface SetRecipientsForTemplateOptions {
  userId: number;
  templateId: number;
  recipients: {
    id?: number | null;
    email: string;
    name: string;
  }[];
}

export const setRecipientsForTemplate = async ({
  userId,
  templateId,
  recipients,
}: SetRecipientsForTemplateOptions) => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      userId,
    },
  });

  if (!template) {
    throw new Error('Template not found');
  }

  const normalizedRecipients = recipients.map((recipient) => ({
    ...recipient,
    email: recipient.email.toLowerCase(),
  }));

  const existingRecipients = await prisma.templateRecipient.findMany({
    where: {
      templateId,
    },
  });

  const removedRecipients = existingRecipients.filter(
    (existingRecipient) =>
      !normalizedRecipients.find(
        (recipient) =>
          recipient.id === existingRecipient.id || recipient.email === existingRecipient.email,
      ),
  );

  const linkedRecipients = normalizedRecipients.map((recipient) => {
    const existing = existingRecipients.find(
      (existingRecipient) =>
        existingRecipient.id === recipient.id || existingRecipient.email === recipient.email,
    );

    return {
      ...recipient,
      _persisted: existing,
    };
  });

  const persistedRecipients = await prisma.$transaction(
    // Disabling as wrapping promises here causes type issues
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    linkedRecipients.map((recipient) =>
      prisma.templateRecipient.upsert({
        where: {
          id: recipient._persisted?.id ?? -1,
          templateId,
        },
        update: {
          name: recipient.name,
          email: recipient.email,
          templateId,
        },
        create: {
          name: recipient.name,
          email: recipient.email,
          token: nanoid(),
          templateToken: nanoid(),
          templateId,
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
