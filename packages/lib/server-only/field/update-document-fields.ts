import type { FieldType } from '@prisma/client';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { TFieldMetaSchema } from '@documenso/lib/types/field-meta';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import {
  createDocumentAuditLogData,
  diffFieldChanges,
} from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { canRecipientFieldsBeModified } from '../../utils/recipients';
import { getDocumentWhereInput } from '../document/get-document-by-id';

export interface UpdateDocumentFieldsOptions {
  userId: number;
  teamId: number;
  documentId: number;
  fields: {
    id: number;
    type?: FieldType;
    pageNumber?: number;
    pageX?: number;
    pageY?: number;
    width?: number;
    height?: number;
    fieldMeta?: TFieldMetaSchema;
  }[];
  requestMetadata: ApiRequestMetadata;
}

export const updateDocumentFields = async ({
  userId,
  teamId,
  documentId,
  fields,
  requestMetadata,
}: UpdateDocumentFieldsOptions) => {
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

  const fieldsToUpdate = fields.map((field) => {
    const originalField = document.fields.find((existingField) => existingField.id === field.id);

    if (!originalField) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Field with id ${field.id} not found`,
      });
    }

    const recipient = document.recipients.find(
      (recipient) => recipient.id === originalField.recipientId,
    );

    // Each field MUST have a recipient associated with it.
    if (!recipient) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Recipient attached to field ${field.id} not found`,
      });
    }

    // Check whether the recipient associated with the field can be modified.
    if (!canRecipientFieldsBeModified(recipient, document.fields)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message:
          'Cannot modify a field where the recipient has already interacted with the document',
      });
    }

    return {
      originalField,
      updateData: field,
      recipientEmail: recipient.email,
    };
  });

  const updatedFields = await prisma.$transaction(async (tx) => {
    return await Promise.all(
      fieldsToUpdate.map(async ({ originalField, updateData, recipientEmail }) => {
        const updatedField = await tx.field.update({
          where: {
            id: updateData.id,
          },
          data: {
            type: updateData.type,
            page: updateData.pageNumber,
            positionX: updateData.pageX,
            positionY: updateData.pageY,
            width: updateData.width,
            height: updateData.height,
            fieldMeta: updateData.fieldMeta,
          },
        });

        const changes = diffFieldChanges(originalField, updatedField);

        // Handle field updated audit log.
        if (changes.length > 0) {
          await tx.documentAuditLog.create({
            data: createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_UPDATED,
              documentId: documentId,
              metadata: requestMetadata,
              data: {
                fieldId: updatedField.secondaryId,
                fieldRecipientEmail: recipientEmail,
                fieldRecipientId: updatedField.recipientId,
                fieldType: updatedField.type,
                changes,
              },
            }),
          });
        }

        return updatedField;
      }),
    );
  });

  return {
    fields: updatedFields,
  };
};
