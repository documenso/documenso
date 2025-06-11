import type { Field } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { isDeepEqual } from 'remeda';

import { validateCheckboxField } from '@documenso/lib/advanced-fields-validation/validate-checkbox';
import { validateDropdownField } from '@documenso/lib/advanced-fields-validation/validate-dropdown';
import { validateNumberField } from '@documenso/lib/advanced-fields-validation/validate-number';
import { validateRadioField } from '@documenso/lib/advanced-fields-validation/validate-radio';
import { validateTextField } from '@documenso/lib/advanced-fields-validation/validate-text';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import {
  type TFieldMetaSchema as FieldMeta,
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZFieldMetaSchema,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import {
  createDocumentAuditLogData,
  diffFieldChanges,
} from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { canRecipientFieldsBeModified } from '../../utils/recipients';
import { getDocumentWhereInput } from '../document/get-document-by-id';

export interface SetFieldsForDocumentOptions {
  userId: number;
  teamId: number;
  documentId: number;
  fields: FieldData[];
  requestMetadata: ApiRequestMetadata;
}

export const setFieldsForDocument = async ({
  userId,
  teamId,
  documentId,
  fields,
  requestMetadata,
}: SetFieldsForDocumentOptions) => {
  const { documentWhereInput } = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const document = await prisma.document.findFirst({
    where: documentWhereInput,
    include: {
      recipients: true,
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

  const existingFields = await prisma.field.findMany({
    where: {
      documentId,
    },
    include: {
      recipient: true,
    },
  });

  const removedFields = existingFields.filter(
    (existingField) => !fields.find((field) => field.id === existingField.id),
  );

  const linkedFields = fields.map((field) => {
    const existing = existingFields.find((existingField) => existingField.id === field.id);

    const recipient = document.recipients.find(
      (recipient) => recipient.email.toLowerCase() === field.signerEmail.toLowerCase(),
    );

    // Each field MUST have a recipient associated with it.
    if (!recipient) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Recipient not found for field ${field.id}`,
      });
    }

    // Check whether the existing field can be modified.
    if (
      existing &&
      hasFieldBeenChanged(existing, field) &&
      !canRecipientFieldsBeModified(recipient, existingFields)
    ) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message:
          'Cannot modify a field where the recipient has already interacted with the document',
      });
    }

    return {
      ...field,
      _persisted: existing,
      _recipient: recipient,
    };
  });

  const persistedFields = await prisma.$transaction(async (tx) => {
    return await Promise.all(
      linkedFields.map(async (field) => {
        const fieldSignerEmail = field.signerEmail.toLowerCase();

        const parsedFieldMeta = field.fieldMeta
          ? ZFieldMetaSchema.parse(field.fieldMeta)
          : undefined;

        if (field.type === FieldType.TEXT && field.fieldMeta) {
          const textFieldParsedMeta = ZTextFieldMeta.parse(field.fieldMeta);
          const errors = validateTextField(textFieldParsedMeta.text || '', textFieldParsedMeta);

          if (errors.length > 0) {
            throw new Error(errors.join(', '));
          }
        }

        if (field.type === FieldType.NUMBER && field.fieldMeta) {
          const numberFieldParsedMeta = ZNumberFieldMeta.parse(field.fieldMeta);
          const errors = validateNumberField(
            String(numberFieldParsedMeta.value),
            numberFieldParsedMeta,
          );

          if (errors.length > 0) {
            throw new Error(errors.join(', '));
          }
        }

        if (field.type === FieldType.CHECKBOX) {
          if (field.fieldMeta) {
            const checkboxFieldParsedMeta = ZCheckboxFieldMeta.parse(field.fieldMeta);
            const errors = validateCheckboxField(
              checkboxFieldParsedMeta?.values?.map((item) => item.value) ?? [],
              checkboxFieldParsedMeta,
            );

            if (errors.length > 0) {
              throw new Error(errors.join(', '));
            }
          } else {
            throw new Error(
              'To proceed further, please set at least one value for the Checkbox field',
            );
          }
        }

        if (field.type === FieldType.RADIO) {
          if (field.fieldMeta) {
            const radioFieldParsedMeta = ZRadioFieldMeta.parse(field.fieldMeta);
            const checkedRadioFieldValue = radioFieldParsedMeta.values?.find(
              (option) => option.checked,
            )?.value;

            const errors = validateRadioField(checkedRadioFieldValue, radioFieldParsedMeta);

            if (errors.length > 0) {
              throw new Error(errors.join('. '));
            }
          } else {
            throw new Error(
              'To proceed further, please set at least one value for the Radio field',
            );
          }
        }

        if (field.type === FieldType.DROPDOWN) {
          if (field.fieldMeta) {
            const dropdownFieldParsedMeta = ZDropdownFieldMeta.parse(field.fieldMeta);
            const errors = validateDropdownField(undefined, dropdownFieldParsedMeta);

            if (errors.length > 0) {
              throw new Error(errors.join('. '));
            }
          } else {
            throw new Error(
              'To proceed further, please set at least one value for the Dropdown field',
            );
          }
        }

        const upsertedField = await tx.field.upsert({
          where: {
            id: field._persisted?.id ?? -1,
            documentId,
          },
          update: {
            page: field.pageNumber,
            positionX: field.pageX,
            positionY: field.pageY,
            width: field.pageWidth,
            height: field.pageHeight,
            fieldMeta: parsedFieldMeta,
          },
          create: {
            type: field.type,
            page: field.pageNumber,
            positionX: field.pageX,
            positionY: field.pageY,
            width: field.pageWidth,
            height: field.pageHeight,
            customText: '',
            inserted: false,
            fieldMeta: parsedFieldMeta,
            document: {
              connect: {
                id: documentId,
              },
            },
            recipient: {
              connect: {
                documentId_email: {
                  documentId,
                  email: fieldSignerEmail,
                },
              },
            },
          },
        });

        if (upsertedField.recipientId === null) {
          throw new Error('Not possible');
        }

        const baseAuditLog = {
          fieldId: upsertedField.secondaryId,
          fieldRecipientEmail: fieldSignerEmail,
          fieldRecipientId: upsertedField.recipientId,
          fieldType: upsertedField.type,
        };

        const changes = field._persisted ? diffFieldChanges(field._persisted, upsertedField) : [];

        // Handle field updated audit log.
        if (field._persisted && changes.length > 0) {
          await tx.documentAuditLog.create({
            data: createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_UPDATED,
              documentId: documentId,
              metadata: requestMetadata,
              data: {
                changes,
                ...baseAuditLog,
              },
            }),
          });
        }

        // Handle field created audit log.
        if (!field._persisted) {
          await tx.documentAuditLog.create({
            data: createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_CREATED,
              documentId: documentId,
              metadata: requestMetadata,
              data: {
                ...baseAuditLog,
              },
            }),
          });
        }

        return upsertedField;
      }),
    );
  });

  if (removedFields.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.field.deleteMany({
        where: {
          id: {
            in: removedFields.map((field) => field.id),
          },
        },
      });

      await tx.documentAuditLog.createMany({
        data: removedFields.map((field) =>
          createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_DELETED,
            documentId: documentId,
            metadata: requestMetadata,
            data: {
              fieldId: field.secondaryId,
              fieldRecipientEmail: field.recipient?.email ?? '',
              fieldRecipientId: field.recipientId ?? -1,
              fieldType: field.type,
            },
          }),
        ),
      });
    });
  }

  // Filter out fields that have been removed or have been updated.
  const filteredFields = existingFields.filter((field) => {
    const isRemoved = removedFields.find((removedField) => removedField.id === field.id);
    const isUpdated = persistedFields.find((persistedField) => persistedField.id === field.id);

    return !isRemoved && !isUpdated;
  });

  return {
    fields: [...filteredFields, ...persistedFields],
  };
};

/**
 * If you change this you MUST update the `hasFieldBeenChanged` function.
 */
type FieldData = {
  id?: number | null;
  type: FieldType;
  signerEmail: string;
  pageNumber: number;
  pageX: number;
  pageY: number;
  pageWidth: number;
  pageHeight: number;
  fieldMeta?: FieldMeta;
};

const hasFieldBeenChanged = (field: Field, newFieldData: FieldData) => {
  const currentFieldMeta = field.fieldMeta || null;
  const newFieldMeta = newFieldData.fieldMeta || null;

  return (
    field.type !== newFieldData.type ||
    field.page !== newFieldData.pageNumber ||
    field.positionX.toNumber() !== newFieldData.pageX ||
    field.positionY.toNumber() !== newFieldData.pageY ||
    field.width.toNumber() !== newFieldData.pageWidth ||
    field.height.toNumber() !== newFieldData.pageHeight ||
    !isDeepEqual(currentFieldMeta, newFieldMeta)
  );
};
