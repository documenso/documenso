import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import type { Recipient } from '@documenso/prisma/client';

type RecipientWithId = {
  id: number;
  name?: string;
  email: string;
};

export type CreateDocumentFromTemplateOptions = {
  templateId: number;
  userId: number;
  teamId?: number;
  recipients:
    | RecipientWithId[]
    | {
        name?: string;
        email: string;
      }[];
};

export const createDocumentFromTemplate = async ({
  templateId,
  userId,
  teamId,
  recipients,
}: CreateDocumentFromTemplateOptions) => {
  const template = await prisma.template.findUnique({
    where: {
      id: templateId,
      ...(teamId
        ? {
            team: {
              id: teamId,
              members: {
                some: {
                  userId,
                },
              },
            },
          }
        : {
            userId,
            teamId: null,
          }),
    },
    include: {
      Recipient: true,
      Field: true,
      templateDocumentData: true,
    },
  });

  if (!template) {
    throw new Error('Template not found.');
  }

  if (recipients.length !== template.Recipient.length) {
    throw new Error('Invalid number of recipients.');
  }

  let finalRecipients: Pick<Recipient, 'name' | 'email' | 'role'>[] = [];

  if (recipients.length > 0 && Object.prototype.hasOwnProperty.call(recipients[0], 'id')) {
    finalRecipients = template.Recipient.map((templateRecipient) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const foundRecipient = (recipients as RecipientWithId[]).find(
        (recipient) => recipient.id === templateRecipient.id,
      );

      if (!foundRecipient) {
        throw new Error('Recipient not found.');
      }

      return {
        name: foundRecipient.name ?? '',
        email: foundRecipient.email,
        role: templateRecipient.role,
      };
    });
  } else {
    // Backwards compatible logic for /v1/ API where we use the index to associate
    // the provided recipient with the template recipient.
    finalRecipients = recipients.map((recipient, index) => ({
      name: recipient.name ?? '',
      email: recipient.email,
      role: template.Recipient[index].role,
    }));
  }

  const documentData = await prisma.documentData.create({
    data: {
      type: template.templateDocumentData.type,
      data: template.templateDocumentData.data,
      initialData: template.templateDocumentData.initialData,
    },
  });

  return await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        userId,
        teamId: template.teamId,
        title: template.title,
        documentDataId: documentData.id,
        Recipient: {
          create: finalRecipients.map((recipient) => ({
            email: recipient.email,
            name: recipient.name,
            role: recipient.role,
            token: nanoid(),
          })),
        },
      },
      include: {
        Recipient: {
          orderBy: {
            id: 'asc',
          },
        },
        documentData: true,
      },
    });

    await tx.field.createMany({
      data: template.Field.map((field) => {
        const recipient = template.Recipient.find(
          (recipient) => recipient.id === field.recipientId,
        );

        const documentRecipient = document.Recipient.find((doc) => doc.email === recipient?.email);

        if (!documentRecipient) {
          throw new Error('Recipient not found.');
        }

        return {
          type: field.type,
          page: field.page,
          positionX: field.positionX,
          positionY: field.positionY,
          width: field.width,
          height: field.height,
          customText: field.customText,
          inserted: field.inserted,
          documentId: document.id,
          recipientId: documentRecipient.id,
        };
      }),
    });

    return document;
  });
};
