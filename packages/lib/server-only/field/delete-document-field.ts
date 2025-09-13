import { EnvelopeType } from '@prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { canRecipientFieldsBeModified } from '../../utils/recipients';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export interface DeleteDocumentFieldOptions {
  userId: number;
  teamId: number;
  fieldId: number;
  requestMetadata: ApiRequestMetadata;
}

export const deleteDocumentField = async ({
  userId,
  teamId,
  fieldId,
  requestMetadata,
}: DeleteDocumentFieldOptions) => {
  // Unauthenticated check, we do the real check later.
  const field = await prisma.field.findFirst({
    where: {
      id: fieldId,
    },
  });

  if (!field) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Field not found',
    });
  }

  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'envelopeId',
      id: field.envelopeId,
    },
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findUnique({
    where: envelopeWhereInput,
    include: {
      recipients: {
        where: {
          id: field.recipientId,
        },
        include: {
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

  if (envelope.completedAt) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Document already complete',
    });
  }

  const recipient = envelope.recipients.find((recipient) => recipient.id === field.recipientId);

  if (!recipient) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Recipient for field ${fieldId} not found`,
    });
  }

  // Check whether the recipient associated with the field can have new fields created.
  if (!canRecipientFieldsBeModified(recipient, recipient.fields)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Recipient has already interacted with the document.',
    });
  }

  return await prisma.$transaction(async (tx) => {
    const deletedField = await tx.field.delete({
      where: {
        id: fieldId,
        envelopeId: envelope.id,
      },
    });

    // Handle field deleted audit log.
    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_DELETED,
        envelopeId: envelope.id,
        metadata: requestMetadata,
        data: {
          fieldId: deletedField.secondaryId,
          fieldRecipientEmail: recipient.email,
          fieldRecipientId: deletedField.recipientId,
          fieldType: deletedField.type,
        },
      }),
    });

    return deletedField;
  });
};
