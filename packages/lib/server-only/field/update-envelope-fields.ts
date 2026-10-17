import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { TFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { FIELD_META_DEFAULT_VALUES } from '@documenso/lib/types/field-meta';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData, diffFieldChanges } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { EnvelopeType, type Field, type FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import {
  assertFieldGroupAllowedForType,
  assertFieldGroupsValid,
  resolveSyncedSiblingFieldMeta,
} from '../../utils/field-groups';
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
    /**
     * Omitted keeps the existing value, null clears it.
     */
    groupId?: string | null;
    /**
     * Omitted keeps the existing value, null clears it.
     */
    externalId?: string | null;
  }[];
  requestMetadata: ApiRequestMetadata;
}

/**
 * Update one or more fields.
 *
 * When a field that belongs to a group is updated, the shared field meta values are
 * propagated to every other field in the group so they remain in sync. Any synced
 * siblings are included in the returned fields.
 */
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
    const isFieldTypeChanged = fieldType !== originalField.type;

    // An omitted value keeps the stored one, an explicit null clears it.
    const groupId = field.groupId === undefined ? originalField.groupId : field.groupId;
    const externalId = field.externalId === undefined ? originalField.externalId : field.externalId;

    // The type of a grouped field can never be changed since it would desync the group.
    if (isFieldTypeChanged && (originalField.groupId || groupId)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Cannot change the type of field ${field.id} because it belongs to a group`,
      });
    }

    assertFieldGroupAllowedForType(fieldType, groupId);

    if (groupId && envelope.internalVersion !== 2) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Field groups are only supported for V2 envelopes',
      });
    }

    // An omitted fieldMeta keeps the stored one, unless the field type changes.
    const fallbackFieldMeta = isFieldTypeChanged ? FIELD_META_DEFAULT_VALUES[fieldType] : undefined;
    const fieldMeta = field.fieldMeta ?? fallbackFieldMeta;
    const fieldMetaType = fieldMeta?.type || originalField.fieldMeta?.type;

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

    return {
      originalField,
      updateData: {
        ...field,
        type: fieldType,
        fieldMeta,
        groupId,
        externalId,
      },
      recipientEmail: recipient.email,
    };
  });

  const updatedFieldIds = new Set(fieldsToUpdate.map(({ updateData }) => updateData.id));

  /*
    Resolve the final state of every field in the envelope so groups can be validated
    as a whole, and work out which group siblings need their shared meta synced.
  */
  const finalFieldStates = new Map<number, FieldGroupState>(
    envelope.fields.map((field) => [
      field.id,
      {
        id: field.id,
        type: field.type,
        recipientId: field.recipientId,
        groupId: field.groupId,
        fieldMeta: field.fieldMeta,
      },
    ]),
  );

  // IDs of updated fields which provided new meta and act as the source of truth for their group.
  const groupSourceFieldIds = new Set<number>();

  for (const { originalField, updateData } of fieldsToUpdate) {
    const isJoiningGroup = updateData.groupId && updateData.groupId !== originalField.groupId;

    if (updateData.groupId && updateData.fieldMeta !== undefined) {
      groupSourceFieldIds.add(updateData.id);
    }

    /*
      A field joining an existing group without providing new field meta adopts the
      shared meta of the group instead of overwriting it.
    */
    if (isJoiningGroup && updateData.fieldMeta === undefined) {
      const existingMember = envelope.fields.find(
        (field) => field.groupId === updateData.groupId && !updatedFieldIds.has(field.id),
      );

      if (existingMember) {
        updateData.fieldMeta = resolveSyncedSiblingFieldMeta(
          updateData.type,
          originalField.fieldMeta,
          existingMember.fieldMeta,
        );
      }
    }

    finalFieldStates.set(updateData.id, {
      id: updateData.id,
      type: updateData.type,
      recipientId: originalField.recipientId,
      groupId: updateData.groupId,
      fieldMeta: updateData.fieldMeta ?? originalField.fieldMeta,
    });
  }

  const siblingUpdates = new Map<number, { originalField: Field; fieldMeta: TFieldMetaSchema }>();

  for (const { updateData: sourceUpdateData } of fieldsToUpdate) {
    if (!sourceUpdateData.groupId || !groupSourceFieldIds.has(sourceUpdateData.id)) {
      continue;
    }

    // Every other member of the group, using its final state in case it is also being updated.
    const siblings = Array.from(finalFieldStates.values()).filter(
      (field) =>
        field.groupId === sourceUpdateData.groupId &&
        field.id !== sourceUpdateData.id &&
        !groupSourceFieldIds.has(field.id),
    );

    for (const sibling of siblings) {
      const syncedMeta = resolveSyncedSiblingFieldMeta(sibling.type, sibling.fieldMeta, sourceUpdateData.fieldMeta);

      const siblingUpdateData = fieldsToUpdate.find(({ updateData }) => updateData.id === sibling.id);

      if (siblingUpdateData) {
        // The sibling is also in the payload, so sync its meta as part of its own update.
        siblingUpdateData.updateData.fieldMeta = syncedMeta;
      } else {
        const originalField = envelope.fields.find((field) => field.id === sibling.id);

        if (originalField) {
          siblingUpdates.set(sibling.id, {
            originalField,
            fieldMeta: syncedMeta,
          });
        }
      }

      finalFieldStates.set(sibling.id, {
        ...sibling,
        fieldMeta: syncedMeta,
      });
    }
  }

  const affectedGroupIds = new Set<string>();

  for (const { originalField, updateData } of fieldsToUpdate) {
    if (originalField.groupId) {
      affectedGroupIds.add(originalField.groupId);
    }

    if (updateData.groupId) {
      affectedGroupIds.add(updateData.groupId);
    }
  }

  if (affectedGroupIds.size > 0) {
    assertFieldGroupsValid(
      Array.from(finalFieldStates.values()).filter((field) => field.groupId && affectedGroupIds.has(field.groupId)),
    );
  }

  const updatedFields = await prisma.$transaction(async (tx) => {
    await assertEnvelopeMutable(envelope, tx);

    const createFieldUpdatedAuditLog = async (originalField: Field, updatedField: Field, recipientEmail: string) => {
      if (envelope.type !== EnvelopeType.DOCUMENT) {
        return;
      }

      const changes = diffFieldChanges(originalField, updatedField);

      if (changes.length === 0) {
        return;
      }

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
    };

    const primaryUpdates = await Promise.all(
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
            groupId: updateData.groupId,
            externalId: updateData.externalId,
          },
        });

        await createFieldUpdatedAuditLog(originalField, updatedField, recipientEmail);

        return updatedField;
      }),
    );

    const syncedSiblingUpdates = await Promise.all(
      Array.from(siblingUpdates.values()).map(async ({ originalField, fieldMeta }) => {
        const updatedField = await tx.field.update({
          where: {
            id: originalField.id,
          },
          data: {
            fieldMeta,
          },
        });

        const recipient = envelope.recipients.find((recipient) => recipient.id === originalField.recipientId);

        await createFieldUpdatedAuditLog(originalField, updatedField, recipient?.email ?? '');

        return updatedField;
      }),
    );

    return [...primaryUpdates, ...syncedSiblingUpdates];
  });

  return {
    fields: updatedFields.map((field) => mapFieldToLegacyField(field, envelope)),
  };
};

type FieldGroupState = {
  id: number;
  type: FieldType;
  recipientId: number;
  groupId: string | null;
  fieldMeta: unknown;
};
