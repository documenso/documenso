import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { canRecipientFieldsBeModified } from '../../utils/recipients';
import { getDocumentWhereInput } from '../document/get-document-by-id';

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
}: DeleteDocumentFieldOptions): Promise<void> => {
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

  const documentId = field.documentId;

  if (!documentId) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Field does not belong to a document. Use delete template field instead.',
    });
  }

  const { documentWhereInput } = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const document = await prisma.document.findFirst({
    where: documentWhereInput,
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

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  if (document.completedAt) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Document already complete',
    });
  }

  const recipient = document.recipients.find((recipient) => recipient.id === field.recipientId);

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

  await prisma.$transaction(async (tx) => {
    const deletedField = await tx.field.delete({
      where: {
        id: fieldId,
      },
    });

    // Handle field deleted audit log.
    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_DELETED,
        documentId,
        metadata: requestMetadata,
        data: {
          fieldId: deletedField.secondaryId,
          fieldRecipientEmail: recipient.email,
          fieldRecipientId: deletedField.recipientId,
          fieldType: deletedField.type,
        },
      }),
    });
  });
};
