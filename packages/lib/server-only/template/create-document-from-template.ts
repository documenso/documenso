import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import type { TCreateDocumentFromTemplateMutationSchema } from '@documenso/trpc/server/template-router/schema';

export type CreateDocumentFromTemplateOptions = TCreateDocumentFromTemplateMutationSchema & {
  userId: number;
};

export const createDocumentFromTemplate = async ({
  templateId,
  userId,
}: CreateDocumentFromTemplateOptions) => {
  const template = await prisma.template.findUnique({
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
    include: {
      Recipient: true,
      Field: true,
      templateDocumentData: true,
    },
  });

  if (!template) {
    throw new Error('Template not found.');
  }

  const documentData = await prisma.documentData.create({
    data: {
      type: template.templateDocumentData.type,
      data: template.templateDocumentData.data,
      initialData: template.templateDocumentData.initialData,
    },
  });

  const document = await prisma.document.create({
    data: {
      userId,
      teamId: template.teamId,
      title: template.title,
      documentDataId: documentData.id,
      Recipient: {
        create: template.Recipient.map((recipient) => ({
          email: recipient.email,
          name: recipient.name,
          token: nanoid(),
        })),
      },
    },

    include: {
      Recipient: true,
    },
  });

  await prisma.field.createMany({
    data: template.Field.map((field) => {
      const recipient = template.Recipient.find((recipient) => recipient.id === field.recipientId);

      const documentRecipient = document.Recipient.find((doc) => doc.email === recipient?.email);

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
        recipientId: documentRecipient?.id || null,
      };
    }),
  });

  return document;
};
