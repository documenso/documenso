import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { TDuplicateTemplateMutationSchema } from '@documenso/trpc/server/template-router/schema';

export type DuplicateTemplateOptions = TDuplicateTemplateMutationSchema & {
  userId: number;
};

export const duplicateTemplate = async ({ templateId, userId }: DuplicateTemplateOptions) => {
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

  const duplicatedTemplate = await prisma.template.create({
    data: {
      userId,
      title: template.title + ' (copy)',
      templateDocumentDataId: documentData.id,
      TemplateRecipient: {
        create: template.TemplateRecipient.map((recipient) => ({
          email: recipient.email,
          name: recipient.name,
          token: nanoid(),
          templateToken: recipient.templateToken,
        })),
      },
    },

    include: {
      TemplateRecipient: true,
    },
  });

  await prisma.templateField.createMany({
    data: template.TemplateField.map((field) => {
      const recipient = template.TemplateRecipient.find(
        (recipient) => recipient.id === field.recipientId,
      );

      const duplicatedTemplateRecipient = duplicatedTemplate.TemplateRecipient.find(
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
        templateId: duplicatedTemplate.id,
        recipientId: duplicatedTemplateRecipient?.id || null,
      };
    }),
  });

  return duplicatedTemplate;
};
