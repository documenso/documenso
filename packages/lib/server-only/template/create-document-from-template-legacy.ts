import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { DocumentSource, type RecipientRole } from '@documenso/prisma/client';

export type CreateDocumentFromTemplateLegacyOptions = {
  templateId: number;
  userId: number;
  teamId?: number;
  recipients?: {
    name?: string;
    email: string;
    role?: RecipientRole;
    signingOrder?: number | null;
  }[];
};

/**
 * Legacy server function for /api/v1
 */
export const createDocumentFromTemplateLegacy = async ({
  templateId,
  userId,
  teamId,
  recipients,
}: CreateDocumentFromTemplateLegacyOptions) => {
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
      templateMeta: true,
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
      source: DocumentSource.TEMPLATE,
      templateId: template.id,
      userId,
      teamId: template.teamId,
      title: template.title,
      documentDataId: documentData.id,
      Recipient: {
        create: template.Recipient.map((recipient) => ({
          email: recipient.email,
          name: recipient.name,
          role: recipient.role,
          signingOrder: recipient.signingOrder,
          token: nanoid(),
        })),
      },
      documentMeta: {
        create: {
          subject: template.templateMeta?.subject,
          message: template.templateMeta?.message,
          timezone: template.templateMeta?.timezone,
          dateFormat: template.templateMeta?.dateFormat,
          redirectUrl: template.templateMeta?.redirectUrl,
          signingOrder: template.templateMeta?.signingOrder ?? undefined,
          language: template.templateMeta?.language,
        },
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

  await prisma.field.createMany({
    data: template.Field.map((field) => {
      const recipient = template.Recipient.find((recipient) => recipient.id === field.recipientId);

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

  if (recipients && recipients.length > 0) {
    document.Recipient = await Promise.all(
      recipients.map(async (recipient, index) => {
        const existingRecipient = document.Recipient.at(index);

        return await prisma.recipient.upsert({
          where: {
            documentId_email: {
              documentId: document.id,
              email: existingRecipient?.email ?? recipient.email,
            },
          },
          update: {
            name: recipient.name,
            email: recipient.email,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
          },
          create: {
            documentId: document.id,
            email: recipient.email,
            name: recipient.name,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            token: nanoid(),
          },
        });
      }),
    );
  }

  return document;
};
