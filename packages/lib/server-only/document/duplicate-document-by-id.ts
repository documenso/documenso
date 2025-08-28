import type { Recipient } from '@prisma/client';
import { DocumentSource, EnvelopeType, WebhookTriggerEvents } from '@prisma/client';
import { omit } from 'remeda';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import {
  ZWebhookDocumentSchema,
  mapEnvelopeToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import { nanoid, prefixedId } from '../../universal/id';
import { buildDocumentId } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

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
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'documentId',
      id: documentId,
    },
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    select: {
      title: true,
      userId: true,
      documents: {
        include: {
          documentData: {
            select: {
              data: true,
              initialData: true,
              type: true,
            },
          },
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

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const createdDocumentMeta = await prisma.documentMeta.create({
    data: {
      ...omit(envelope.documentMeta, ['id']),
      emailSettings: envelope.documentMeta.emailSettings || undefined,
    },
  });

  const documentIdCounter = await prisma.counter.update({
    where: {
      id: 'document',
    },
    data: {
      value: {
        increment: 1,
      },
    },
  });

  const createdEnvelopeDocumentId = documentIdCounter.value;

  const createdEnvelope = await prisma.envelope.create({
    data: {
      secondaryId: buildDocumentId(createdEnvelopeDocumentId),
      type: EnvelopeType.DOCUMENT,
      userId: envelope.userId,
      teamId: teamId,
      title: envelope.title,
      documentMetaId: createdDocumentMeta.id,
      authOptions: envelope.authOptions || undefined,
      visibility: envelope.visibility,
      qrToken: prefixedId('qr'),
      source: DocumentSource.DOCUMENT,
    },
    include: {
      recipients: true,
      documentMeta: true,
    },
  });

  await Promise.all(
    envelope.documents.map(async (document) => {
      const createdDocumentData = await prisma.documentData.create({
        data: {
          type: document.documentData.type,
          data: document.documentData.initialData,
          initialData: document.documentData.initialData,
        },
      });

      await prisma.document.create({
        data: {
          title: document.title,
          envelopeId: createdEnvelope.id,
          documentDataId: createdDocumentData.id,
        },
      });
    }),
  );

  const recipientsToCreate = envelope.recipients.map((recipient) => ({
    envelopeId: createdEnvelope.id,
    email: recipient.email,
    name: recipient.name,
    role: recipient.role,
    signingOrder: recipient.signingOrder,
    token: nanoid(),
    fields: {
      createMany: {
        data: recipient.fields.map((field) => ({
          envelopeId: createdEnvelope.id,
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
      ...mapEnvelopeToWebhookDocumentPayload(createdEnvelope),
      recipients,
      documentMeta: createdEnvelope.documentMeta,
    }),
    userId: userId,
    teamId: teamId,
  });

  return {
    documentId: createdEnvelopeDocumentId,
  };
};
