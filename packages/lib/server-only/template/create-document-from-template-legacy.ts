import { DocumentSource, type RecipientRole } from '@prisma/client';

import { nanoid, prefixedId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import { extractDerivedDocumentMeta } from '../../utils/document';
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

// !TODO: Make this work

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
      team: buildTeamWhereQuery({ teamId, userId }),
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

  const recipientsToCreate = template.recipients.map((recipient) => ({
    id: recipient.id,
    email: recipient.email,
    name: recipient.name,
    role: recipient.role,
    signingOrder: recipient.signingOrder,
    token: nanoid(),
  }));

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
        create: recipientsToCreate.map((recipient) => ({
          email: recipient.email,
          name: recipient.name,
          role: recipient.role,
          signingOrder: recipient.signingOrder,
          token: recipient.token,
        })),
      },
      documentMeta: {
        create: extractDerivedDocumentMeta(settings, template.templateMeta),
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
      const recipient = recipientsToCreate.find((recipient) => recipient.id === field.recipientId);

      const documentRecipient = document.recipients.find(
        (documentRecipient) => documentRecipient.token === recipient?.token,
      );

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

  // Replicate the old logic, get by index and create if we exceed the number of existing recipients.
  if (recipients && recipients.length > 0) {
    await Promise.all(
      recipients.map(async (recipient, index) => {
        const existingRecipient = document.recipients.at(index);

        if (existingRecipient) {
          return await prisma.recipient.update({
            where: {
              id: existingRecipient.id,
              documentId: document.id,
            },
            data: {
              name: recipient.name,
              email: recipient.email,
              role: recipient.role,
              signingOrder: recipient.signingOrder,
            },
          });
        }

        return await prisma.recipient.create({
          data: {
            documentId: document.id,
            name: recipient.name,
            email: recipient.email,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            token: nanoid(),
          },
        });
      }),
    );
  }

  // Gross but we need to do the additional fetch since we mutate above.
  const updatedRecipients = await prisma.recipient.findMany({
    where: {
      documentId: document.id,
    },
    orderBy: {
      id: 'asc',
    },
  });

  return {
    ...document,
    recipients: updatedRecipients,
  };
};
