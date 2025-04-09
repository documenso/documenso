import { DocumentSource, type RecipientRole } from '@prisma/client';

import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

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
      recipients: true,
      fields: true,
      templateDocumentData: true,
      templateMeta: true,
      team: {
        include: {
          teamGlobalSettings: true,
        },
      },
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
      visibility: template.team?.teamGlobalSettings?.documentVisibility,
      documentDataId: documentData.id,
      recipients: {
        create: template.recipients.map((recipient) => ({
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
          language:
            template.templateMeta?.language || template.team?.teamGlobalSettings?.documentLanguage,
          typedSignatureEnabled: template.templateMeta?.typedSignatureEnabled,
          uploadSignatureEnabled: template.templateMeta?.uploadSignatureEnabled,
          drawSignatureEnabled: template.templateMeta?.drawSignatureEnabled,
        },
      },
    },

    include: {
      recipients: {
        orderBy: {
          id: 'asc',
        },
      },
      documentData: true,
    },
  });

  await prisma.field.createMany({
    data: template.fields.map((field) => {
      const recipient = template.recipients.find((recipient) => recipient.id === field.recipientId);

      const documentRecipient = document.recipients.find((doc) => doc.email === recipient?.email);

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
    document.recipients = await Promise.all(
      recipients.map(async (recipient, index) => {
        const existingRecipient = document.recipients.at(index);

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
