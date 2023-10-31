import { prisma } from '@documenso/prisma';

export type CreateTemplateFromDocumentOptions = {
  documentId: number;
  userId: number;
};

export const createTemplateFromDocument = async ({
  documentId,
  userId,
}: CreateTemplateFromDocumentOptions) => {
  // Fetch the document
  const document = await prisma.document.findUnique({
    where: { id: documentId, userId },
    include: {
      Recipient: true,
      Field: true,
      documentData: true,
    },
  });

  if (!document) {
    throw new Error('Document not found.');
  }

  // Create the templateDocumentData
  const templateDocumentData = await prisma.documentData.create({
    data: {
      type: document.documentData.type,
      data: document.documentData.data,
      initialData: document.documentData.initialData,
    },
  });

  // Create the template
  const template = await prisma.template.create({
    data: {
      userId,
      title: document.title,
      templateDocumentDataId: templateDocumentData.id,
      TemplateRecipient: {
        create: document.Recipient.map((recipient) => ({
          email: recipient.email,
          name: recipient.name,
          token: recipient.token, // This can be changed or generated anew
          templateToken: recipient.templateToken,
        })),
      },
    },
    include: {
      TemplateRecipient: true,
    },
  });

  // Create the TemplateField
  await prisma.templateField.createMany({
    data: document.Field.map((field) => {
      const recipient = document.Recipient.find((recipient) => recipient.id === field.recipientId);

      const templateRecipient = template.TemplateRecipient.find(
        (tempRecip) => tempRecip.templateToken === recipient?.templateToken,
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
        templateId: template.id,
        recipientId: templateRecipient?.id || null,
      };
    }),
  });

  return template;
};
