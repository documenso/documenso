import { EnvelopeType, type Field, FieldType } from '@prisma/client';
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
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { mapFieldToLegacyField } from '../../utils/fields';
import { canRecipientFieldsBeModified } from '../../utils/recipients';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export interface SetFieldsForDocumentOptions {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;
  fields: FieldData[];
  requestMetadata: ApiRequestMetadata;
}

export const setFieldsForDocument = async ({
  userId,
  teamId,
  id,
  fields,
  requestMetadata,
}: SetFieldsForDocumentOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      recipients: true,
      envelopeItems: {
        select: {
          id: true,
        },
      },
      fields: {
        include: {
          recipient: true,
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

  const existingFields = envelope.fields;

  const removedFields = existingFields.filter(
    (existingField) => !fields.find((field) => field.id === existingField.id),
  );

  const linkedFields = fields.map((field) => {
    const existing = existingFields.find((existingField) => existingField.id === field.id);

    const recipient = envelope.recipients.find((recipient) => recipient.id === field.recipientId);

    // Check whether the field is being attached to an allowed envelope item.
    const foundEnvelopeItem = envelope.envelopeItems.find(
      (envelopeItem) => envelopeItem.id === field.envelopeItemId,
    );

    if (!foundEnvelopeItem) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Envelope item ${field.envelopeItemId} not found`,
      });
    }

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

    // Prevent creating new fields when recipient has interacted with the document.
    if (!existing && !canRecipientFieldsBeModified(recipient, existingFields)) {
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
        const fieldSignerEmail = field._recipient.email.toLowerCase();

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
            String(numberFieldParsedMeta.value || ''),
            numberFieldParsedMeta,
            false,
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
            envelopeId: envelope.id,
            envelopeItemId: field.envelopeItemId,
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
            envelope: {
              connect: {
                id: envelope.id,
              },
            },
            envelopeItem: {
              connect: {
                id: field.envelopeItemId,
                envelopeId: envelope.id,
              },
            },
            recipient: {
              connect: {
                id: field._recipient.id,
                envelopeId: envelope.id,
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
              envelopeId: envelope.id,
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
              envelopeId: envelope.id,
              metadata: requestMetadata,
              data: {
                ...baseAuditLog,
              },
            }),
          });
        }

        return {
          ...upsertedField,
          formId: field.formId,
        };
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
            envelopeId: envelope.id,
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
  const mappedFilteredFields = existingFields
    .filter((field) => {
      const isRemoved = removedFields.find((removedField) => removedField.id === field.id);
      const isUpdated = persistedFields.find((persistedField) => persistedField.id === field.id);

      return !isRemoved && !isUpdated;
    })
    .map((field) => ({
      ...mapFieldToLegacyField(field, envelope),
      formId: undefined,
    }));

  const mappedPersistentFields = persistedFields.map((field) => ({
    ...mapFieldToLegacyField(field, envelope),
    formId: field?.formId,
  }));

  return {
    fields: [...mappedFilteredFields, ...mappedPersistentFields],
  };
};

/**
 * If you change this you MUST update the `hasFieldBeenChanged` function.
 */
type FieldData = {
  id?: number | null;
  formId?: string;
  envelopeItemId: string;
  type: FieldType;
  recipientId: number;
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
    field.envelopeItemId !== newFieldData.envelopeItemId ||
    field.type !== newFieldData.type ||
    field.page !== newFieldData.pageNumber ||
    field.positionX.toNumber() !== newFieldData.pageX ||
    field.positionY.toNumber() !== newFieldData.pageY ||
    field.width.toNumber() !== newFieldData.pageWidth ||
    field.height.toNumber() !== newFieldData.pageHeight ||
    !isDeepEqual(currentFieldMeta, newFieldMeta)
  );
};
