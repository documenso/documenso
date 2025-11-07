import { EnvelopeType } from '@prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { TFieldAndMeta } from '@documenso/lib/types/field-meta';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { mapFieldToLegacyField } from '../../utils/fields';
import { canRecipientFieldsBeModified } from '../../utils/recipients';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export interface CreateEnvelopeFieldsOptions {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;

  fields: (TFieldAndMeta & {
    /**
     * The ID of the item to insert the fields into.
     *
     * If blank, the first item will be used.
     */
    envelopeItemId?: string;

    recipientId: number;
    page: number;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
  })[];
  requestMetadata: ApiRequestMetadata;
}

export const createEnvelopeFields = async ({
  userId,
  teamId,
  id,
  fields,
  requestMetadata,
}: CreateEnvelopeFieldsOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: null, // Null to allow any type of envelope.
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      recipients: true,
      fields: true,
      envelopeItems: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  if (envelope.type === EnvelopeType.DOCUMENT && envelope.completedAt) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Envelope already complete',
    });
  }

  const firstEnvelopeItem = envelope.envelopeItems[0];

  if (!firstEnvelopeItem) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope item not found',
    });
  }

  // Field validation.
  const validatedFields = fields.map((field) => {
    const recipient = envelope.recipients.find((recipient) => recipient.id === field.recipientId);

    // The item to attach the fields to MUST belong to the document.
    if (
      field.envelopeItemId &&
      !envelope.envelopeItems.find((envelopeItem) => envelopeItem.id === field.envelopeItemId)
    ) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Item to attach fields to must belong to the document',
      });
    }

    // Each field MUST have a recipient associated with it.
    if (!recipient) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Recipient ${field.recipientId} not found`,
      });
    }

    // Check whether the recipient associated with the field can have new fields created.
    if (!canRecipientFieldsBeModified(recipient, envelope.fields)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message:
          'Recipient type cannot have fields, or they have already interacted with the document.',
      });
    }

    return {
      ...field,
      envelopeItemId: field.envelopeItemId || firstEnvelopeItem.id, // Fallback to first envelope item if no envelope item ID is provided.
      recipientEmail: recipient.email,
    };
  });

  const createdFields = await prisma.$transaction(async (tx) => {
    const newlyCreatedFields = await tx.field.createManyAndReturn({
      data: validatedFields.map((field) => ({
        type: field.type,
        page: field.page,
        positionX: field.positionX,
        positionY: field.positionY,
        width: field.width,
        height: field.height,
        customText: '',
        inserted: false,
        fieldMeta: field.fieldMeta,
        envelopeId: envelope.id,
        envelopeItemId: field.envelopeItemId,
        recipientId: field.recipientId,
      })),
    });

    // Handle field created audit log.
    if (envelope.type === EnvelopeType.DOCUMENT) {
      await tx.documentAuditLog.createMany({
        data: newlyCreatedFields.map((createdField) => {
          const recipient = validatedFields.find(
            (field) => field.recipientId === createdField.recipientId,
          );

          return createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_CREATED,
            envelopeId: envelope.id,
            metadata: requestMetadata,
            data: {
              fieldId: createdField.secondaryId,
              fieldRecipientEmail: recipient?.recipientEmail || '',
              fieldRecipientId: createdField.recipientId,
              fieldType: createdField.type,
            },
          });
        }),
      });
    }

    return newlyCreatedFields;
  });

  return {
    fields: createdFields.map((field) => mapFieldToLegacyField(field, envelope)),
  };
};
