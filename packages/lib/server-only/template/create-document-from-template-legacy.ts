import { DocumentSource, type RecipientRole } from '@prisma/client';

import { nanoid, prefixedId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import { buildTeamWhereQuery } from '../../utils/teams';
import { getTeamSettings } from '../team/get-team-settings';

export type CreateDocumentFromTemplateLegacyOptions = {
  templateId: number;
  userId: number;
  teamId: number;
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
      team: buildTeamWhereQuery(teamId, userId),
    },
    include: {
      recipients: true,
      fields: true,
      templateDocumentData: true,
      templateMeta: true,
    },
  });

  if (!template) {
    throw new Error('Template not found.');
  }

  const settings = await getTeamSettings({
    userId,
    teamId,
  });

  const documentData = await prisma.documentData.create({
    data: {
      type: template.templateDocumentData.type,
      data: template.templateDocumentData.data,
      initialData: template.templateDocumentData.initialData,
    },
  });

  const document = await prisma.document.create({
    data: {
      qrToken: prefixedId('qr'),
      source: DocumentSource.TEMPLATE,
      templateId: template.id,
      userId,
      teamId: template.teamId,
      title: template.title,
      visibility: settings.documentVisibility,
      documentDataId: documentData.id,
      useLegacyFieldInsertion: template.useLegacyFieldInsertion ?? false,
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
          language: template.templateMeta?.language || settings.documentLanguage,
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
