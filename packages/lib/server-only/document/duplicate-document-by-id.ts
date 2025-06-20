import { DocumentSource, WebhookTriggerEvents } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import { nanoid, prefixedId } from '../../universal/id';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';
import { getDocumentWhereInput } from './get-document-by-id';

export interface DuplicateDocumentOptions {
  documentId: number;
  userId: number;
  teamId: number;
}

export const duplicateDocument = async ({
  documentId,
  userId,
  teamId,
}: DuplicateDocumentOptions) => {
  const { documentWhereInput } = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const document = await prisma.document.findFirst({
    where: documentWhereInput,
    select: {
      title: true,
      userId: true,
      documentData: {
        select: {
          data: true,
          initialData: true,
          type: true,
        },
      },
      documentMeta: {
        select: {
          message: true,
          subject: true,
          dateFormat: true,
          password: true,
          timezone: true,
          redirectUrl: true,
        },
      },
      recipients: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          signingOrder: true,
        },
      },
      fields: {
        select: {
          recipientId: true,
          type: true,
          page: true,
          positionX: true,
          positionY: true,
          width: true,
          height: true,
          customText: true,
          inserted: true,
          fieldMeta: true,
        },
      },
    },
  });

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const createdDocument = await prisma.$transaction(async (tx) => {
    const newDocument = await tx.document.create({
      data: {
        title: document.title,
        qrToken: prefixedId('qr'),
        user: {
          connect: {
            id: document.userId,
          },
        },
        team: {
          connect: {
            id: teamId,
          },
        },
        documentData: {
          create: {
            ...document.documentData,
            data: document.documentData.initialData,
          },
        },
        documentMeta: {
          create: {
            ...document.documentMeta,
          },
        },
        source: DocumentSource.DOCUMENT,
      },
      include: {
        recipients: true,
        documentMeta: true,
      },
    });

    if (document.recipients.length > 0) {
      const recipientMap = new Map<number, number>();

      for (const recipient of document.recipients) {
        const newRecipient = await tx.recipient.create({
          data: {
            documentId: newDocument.id,
            email: recipient.email,
            name: recipient.name,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            token: nanoid(),
          },
        });

        recipientMap.set(recipient.id, newRecipient.id);
      }

      if (document.fields.length > 0) {
        await tx.field.createMany({
          data: document.fields.map((field) => ({
            documentId: newDocument.id,
            recipientId: recipientMap.get(field.recipientId)!,
            type: field.type,
            page: field.page,
            positionX: field.positionX,
            positionY: field.positionY,
            width: field.width,
            height: field.height,
            customText: '',
            inserted: false,
            fieldMeta: field.fieldMeta as PrismaJson.FieldMeta,
          })),
        });
      }
    }

    return await tx.document.findUniqueOrThrow({
      where: { id: newDocument.id },
      include: {
        recipients: true,
        documentMeta: true,
      },
    });
  });

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_CREATED,
    data: ZWebhookDocumentSchema.parse({
      ...mapDocumentToWebhookDocumentPayload(createdDocument),
      recipients: createdDocument.recipients,
      documentMeta: createdDocument.documentMeta,
    }),
    userId: userId,
    teamId: teamId,
  });

  return {
    documentId: createdDocument.id,
  };
};
