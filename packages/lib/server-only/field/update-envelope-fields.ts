import { validateCheckboxField } from '@documenso/lib/advanced-fields-validation/validate-checkbox';
import { validateDropdownField } from '@documenso/lib/advanced-fields-validation/validate-dropdown';
import { validateNumberField } from '@documenso/lib/advanced-fields-validation/validate-number';
import { validateRadioField } from '@documenso/lib/advanced-fields-validation/validate-radio';
import { validateTextField } from '@documenso/lib/advanced-fields-validation/validate-text';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
  type TFieldMetaSchema,
} from '@documenso/lib/types/field-meta';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData, diffFieldChanges } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { EnvelopeType, FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { mapFieldToLegacyField } from '../../utils/fields';
import { canRecipientFieldsBeModified } from '../../utils/recipients';
import { assertEnvelopeMutable } from '../envelope/assert-envelope-mutable';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export interface UpdateEnvelopeFieldsOptions {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;
  type?: EnvelopeType | null; // Only used to enforce the type.
  fields: {
    id: number;
    type?: FieldType;
    pageNumber?: number;
    envelopeItemId?: string;
    pageX?: number;
    pageY?: number;
    width?: number;
    height?: number;
    fieldMeta?: TFieldMetaSchema;
  }[];
  requestMetadata: ApiRequestMetadata;
}

export const updateEnvelopeFields = async ({
  userId,
  teamId,
  id,
  type = null,
  fields,
  requestMetadata,
}: UpdateEnvelopeFieldsOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      recipients: true,
      fields: true,
      envelopeItems: true,
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  assertEnvelopeMutable(envelope);

  if (envelope.completedAt) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Envelope already complete',
    });
  }

  const fieldsToUpdate = fields.map((field) => {
    const originalField = envelope.fields.find((existingField) => existingField.id === field.id);

    if (!originalField) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Field with id ${field.id} not found`,
      });
    }

    const recipient = envelope.recipients.find((recipient) => recipient.id === originalField.recipientId);

    // Each field MUST have a recipient associated with it.
    if (!recipient) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Recipient attached to field ${field.id} not found`,
      });
    }

    // Check whether the recipient associated with the field can be modified.
    if (!canRecipientFieldsBeModified(recipient, envelope.fields)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Cannot modify a field where the recipient has already interacted with the document',
      });
    }

    const fieldType = field.type || originalField.type;
    const fieldMetaType = field.fieldMeta?.type || originalField.fieldMeta?.type;

    // Not going to mess with V1 envelopes.
    if (envelope.internalVersion === 2 && fieldMetaType && fieldMetaType.toLowerCase() !== fieldType.toLowerCase()) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Field meta type does not match the field type',
      });
    }

    if (field.envelopeItemId && !envelope.envelopeItems.some((item) => item.id === field.envelopeItemId)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Envelope item not found',
      });
    }

    if (field.fieldMeta) {
      if (fieldType === FieldType.TEXT) {
        const parsed = ZTextFieldMeta.safeParse(field.fieldMeta);
        if (parsed.success) {
          const errors = validateTextField(parsed.data.text || '', parsed.data);
          if (errors.length > 0) {
            throw new AppError(AppErrorCode.INVALID_REQUEST, {
              message: errors.join(', '),
            });
          }
        }
      } else if (fieldType === FieldType.NUMBER) {
        const parsed = ZNumberFieldMeta.safeParse(field.fieldMeta);
        if (parsed.success) {
          const errors = validateNumberField(String(parsed.data.value || ''), parsed.data, false);
          if (errors.length > 0) {
            throw new AppError(AppErrorCode.INVALID_REQUEST, {
              message: errors.join(', '),
            });
          }
        }
      } else if (fieldType === FieldType.CHECKBOX) {
        const parsed = ZCheckboxFieldMeta.safeParse(field.fieldMeta);
        if (parsed.success) {
          const errors = validateCheckboxField(
            parsed.data?.values?.map((item) => item.value) ?? [],
            parsed.data,
          );
          if (errors.length > 0) {
            throw new AppError(AppErrorCode.INVALID_REQUEST, {
              message: errors.join(', '),
            });
          }
        }
      } else if (fieldType === FieldType.RADIO) {
        const parsed = ZRadioFieldMeta.safeParse(field.fieldMeta);
        if (parsed.success) {
          const checkedValue = parsed.data.values?.find((option) => option.checked)?.value;
          const errors = validateRadioField(checkedValue, parsed.data);
          if (errors.length > 0) {
            throw new AppError(AppErrorCode.INVALID_REQUEST, {
              message: errors.join('. '),
            });
          }
        }
      } else if (fieldType === FieldType.DROPDOWN) {
        const parsed = ZDropdownFieldMeta.safeParse(field.fieldMeta);
        if (parsed.success) {
          const errors = validateDropdownField(parsed.data.defaultValue, parsed.data);
          if (errors.length > 0) {
            throw new AppError(AppErrorCode.INVALID_REQUEST, {
              message: errors.join(', '),
            });
          }
        }
      }
    }

    return {
      originalField,
      updateData: field,
      recipientEmail: recipient.email,
    };
  });

  const updatedFields = await prisma.$transaction(async (tx) => {
    await assertEnvelopeMutable(envelope, tx);

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
            envelopeItemId: updateData.envelopeItemId,
          },
        });

        // Handle field updated audit log.
        if (envelope.type === EnvelopeType.DOCUMENT) {
          const changes = diffFieldChanges(originalField, updatedField);

          if (changes.length > 0) {
            await tx.documentAuditLog.create({
              data: createDocumentAuditLogData({
                type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_UPDATED,
                envelopeId: envelope.id,
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
        }

        return updatedField;
      }),
    );
  });

  return {
    fields: updatedFields.map((field) => mapFieldToLegacyField(field, envelope)),
  };
};
