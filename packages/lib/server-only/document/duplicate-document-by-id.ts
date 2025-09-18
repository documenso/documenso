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
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { incrementDocumentId } from '../envelope/increment-id';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export interface DuplicateDocumentOptions {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
}

export const duplicateDocument = async ({ id, userId, teamId }: DuplicateDocumentOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    select: {
      title: true,
      userId: true,
      envelopeItems: {
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
      teamId: true,
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const { documentId, formattedDocumentId } = await incrementDocumentId();

  const createdDocumentMeta = await prisma.documentMeta.create({
    data: {
      ...omit(envelope.documentMeta, ['id']),
      emailSettings: envelope.documentMeta.emailSettings || undefined,
    },
  });

  const duplicatedEnvelope = await prisma.envelope.create({
    data: {
      id: prefixedId('envelope'),
      secondaryId: formattedDocumentId,
      type: EnvelopeType.DOCUMENT,
      userId,
      teamId,
      title: envelope.title,
      documentMetaId: createdDocumentMeta.id,
      authOptions: envelope.authOptions || undefined,
      visibility: envelope.visibility,
      source: DocumentSource.DOCUMENT,
    },
    include: {
      recipients: true,
      documentMeta: true,
    },
  });

  // Key = original envelope item ID
  // Value = duplicated envelope item ID.
  const oldEnvelopeItemToNewEnvelopeItemIdMap: Record<string, string> = {};

  // Duplicate the envelope items.
  await Promise.all(
    envelope.envelopeItems.map(async (envelopeItem) => {
      const duplicatedDocumentData = await prisma.documentData.create({
        data: {
          type: envelopeItem.documentData.type,
          data: envelopeItem.documentData.initialData,
          initialData: envelopeItem.documentData.initialData,
        },
      });

      const duplicatedEnvelopeItem = await prisma.envelopeItem.create({
        data: {
          id: prefixedId('envelope_item'),
          title: envelopeItem.title,
          envelopeId: duplicatedEnvelope.id,
          documentDataId: duplicatedDocumentData.id,
        },
      });

      oldEnvelopeItemToNewEnvelopeItemIdMap[envelopeItem.id] = duplicatedEnvelopeItem.id;
    }),
  );

  const recipients: Recipient[] = [];

  for (const recipient of envelope.recipients) {
    const duplicatedRecipient = await prisma.recipient.create({
      data: {
        envelopeId: duplicatedEnvelope.id,
        email: recipient.email,
        name: recipient.name,
        role: recipient.role,
        signingOrder: recipient.signingOrder,
        token: nanoid(),
        fields: {
          createMany: {
            data: recipient.fields.map((field) => ({
              envelopeId: duplicatedEnvelope.id,
              envelopeItemId: oldEnvelopeItemToNewEnvelopeItemIdMap[field.envelopeItemId],
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
      },
    });

    recipients.push(duplicatedRecipient);
  }

  const refetchedEnvelope = await prisma.envelope.findFirstOrThrow({
    where: {
      id: duplicatedEnvelope.id,
    },
    include: {
      documentMeta: true,
      recipients: true,
    },
  });

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_CREATED,
    data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(refetchedEnvelope)),
    userId: userId,
    teamId: teamId,
  });

  return {
    documentId,
  };
};
