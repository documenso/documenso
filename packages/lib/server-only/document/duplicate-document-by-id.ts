import type { Prisma, Recipient } from '@prisma/client';
import { DocumentSource, WebhookTriggerEvents } from '@prisma/client';
import { omit } from 'remeda';

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
      authOptions: true,
      visibility: true,
      documentMeta: true,
      recipients: {
        select: {
          email: true,
          name: true,
          role: true,
          signingOrder: true,
          fields: true,
        },
      },
    },
  });

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const documentData = await prisma.documentData.create({
    data: {
      type: document.documentData.type,
      data: document.documentData.initialData,
      initialData: document.documentData.initialData,
    },
  });

  let documentMeta: Prisma.DocumentCreateArgs['data']['documentMeta'] | undefined = undefined;

  if (document.documentMeta) {
    documentMeta = {
      create: {
        ...omit(document.documentMeta, ['id', 'documentId']),
        emailSettings: document.documentMeta.emailSettings || undefined,
      },
    };
  }

  const createdDocument = await prisma.document.create({
    data: {
      userId: document.userId,
      teamId: teamId,
      title: document.title,
      documentDataId: documentData.id,
      authOptions: document.authOptions || undefined,
      visibility: document.visibility,
      qrToken: prefixedId('qr'),
      documentMeta,
      source: DocumentSource.DOCUMENT,
    },
    include: {
      recipients: true,
      documentMeta: true,
    },
  });

  const recipientsToCreate = document.recipients.map((recipient) => ({
    documentId: createdDocument.id,
    email: recipient.email,
    name: recipient.name,
    role: recipient.role,
    signingOrder: recipient.signingOrder,
    token: nanoid(),
    fields: {
      createMany: {
        data: recipient.fields.map((field) => ({
          documentId: createdDocument.id,
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
      },
    },
  }));

  const recipients: Recipient[] = [];

  for (const recipientData of recipientsToCreate) {
    const newRecipient = await prisma.recipient.create({
      data: recipientData,
    });

    recipients.push(newRecipient);
  }

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_CREATED,
    data: ZWebhookDocumentSchema.parse({
      ...mapDocumentToWebhookDocumentPayload(createdDocument),
      recipients,
      documentMeta: createdDocument.documentMeta,
    }),
    userId: userId,
    teamId: teamId,
  });

  return {
    documentId: createdDocument.id,
  };
};
