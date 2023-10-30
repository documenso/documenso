import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { TCreateDocumentFromTemplateMutationSchema } from '@documenso/trpc/server/template-router/schema';

export type CreateDocumentFromTemplateOptions = TCreateDocumentFromTemplateMutationSchema & {
  userId: number;
};

export const createDocumentFromTempate = async ({
  templateId,
  userId,
}: CreateDocumentFromTemplateOptions) => {
  const template = await prisma.template.findUnique({
    where: { id: templateId, userId },
    include: {
      TemplateRecipient: true,
      TemplateField: true,
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
      title: template.title,
      documentDataId: documentData.id,
      Recipient: {
        create: template.TemplateRecipient.map((recipient) => ({
          email: recipient.email,
          name: recipient.name,
          token: nanoid(),
          templateToken: recipient.templateToken,
        })),
      },
    },

    include: {
      Recipient: true,
    },
  });

  await prisma.field.createMany({
    data: template.TemplateField.map((field) => {
      const recipient = template.TemplateRecipient.find(
        (recipient) => recipient.id === field.recipientId,
      );

      const documentRecipient = document.Recipient.find(
        (doc) => doc.templateToken === recipient?.templateToken,
      );

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
