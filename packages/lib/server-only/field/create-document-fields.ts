import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { TFieldAndMeta } from '@documenso/lib/types/field-meta';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { canRecipientFieldsBeModified } from '../../utils/recipients';
import { getDocumentWhereInput } from '../document/get-document-by-id';

export interface CreateDocumentFieldsOptions {
  userId: number;
  teamId: number;
  documentId: number;
  fields: (TFieldAndMeta & {
    recipientId: number;
    pageNumber: number;
    pageX: number;
    pageY: number;
    width: number;
    height: number;
  })[];
  requestMetadata: ApiRequestMetadata;
}

export const createDocumentFields = async ({
  userId,
  teamId,
  documentId,
  fields,
  requestMetadata,
}: CreateDocumentFieldsOptions) => {
  const { documentWhereInput } = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const document = await prisma.document.findFirst({
    where: documentWhereInput,
    include: {
      recipients: true,
      fields: true,
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

  // Field validation.
  const validatedFields = fields.map((field) => {
    const recipient = document.recipients.find((recipient) => recipient.id === field.recipientId);

    // Each field MUST have a recipient associated with it.
    if (!recipient) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Recipient ${field.recipientId} not found`,
      });
    }

    // Check whether the recipient associated with the field can have new fields created.
    if (!canRecipientFieldsBeModified(recipient, document.fields)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message:
          'Recipient type cannot have fields, or they have already interacted with the document.',
      });
    }

    return {
      ...field,
      recipientEmail: recipient.email,
    };
  });

  const createdFields = await prisma.$transaction(async (tx) => {
    return await Promise.all(
      validatedFields.map(async (field) => {
        const createdField = await tx.field.create({
          data: {
            type: field.type,
            page: field.pageNumber,
            positionX: field.pageX,
            positionY: field.pageY,
            width: field.width,
            height: field.height,
            customText: '',
            inserted: false,
            fieldMeta: field.fieldMeta,
            documentId,
            recipientId: field.recipientId,
          },
        });

        // Handle field created audit log.
        await tx.documentAuditLog.create({
          data: createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_CREATED,
            documentId,
            metadata: requestMetadata,
            data: {
              fieldId: createdField.secondaryId,
              fieldRecipientEmail: field.recipientEmail,
              fieldRecipientId: createdField.recipientId,
              fieldType: createdField.type,
            },
          }),
        });

        return createdField;
      }),
    );
  });

  return {
    fields: createdFields,
  };
};
