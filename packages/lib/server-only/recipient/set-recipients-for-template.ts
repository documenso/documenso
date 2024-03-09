import { prisma } from '@documenso/prisma';
import type { RecipientRole } from '@documenso/prisma/client';

import { nanoid } from '../../universal/id';

export type SetRecipientsForTemplateOptions = {
  userId: number;
  templateId: number;
  recipients: {
    id?: number;
    email: string;
    name: string;
    role: RecipientRole;
  }[];
};

export const setRecipientsForTemplate = async ({
  userId,
  templateId,
  recipients,
}: SetRecipientsForTemplateOptions) => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      OR: [
        {
          userId,
        },
        {
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
  });

  if (!template) {
    throw new Error('Template not found');
  }

  const normalizedRecipients = recipients.map((recipient) => ({
    ...recipient,
    email: recipient.email.toLowerCase(),
  }));

  const existingRecipients = await prisma.recipient.findMany({
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
      prisma.recipient.upsert({
        where: {
          id: recipient._persisted?.id ?? -1,
          templateId,
        },
        update: {
          name: recipient.name,
          email: recipient.email,
          role: recipient.role,
          templateId,
        },
        create: {
          name: recipient.name,
          email: recipient.email,
          role: recipient.role,
          token: nanoid(),
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
