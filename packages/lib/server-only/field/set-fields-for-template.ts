import {
  FIELD_META_DEFAULT_VALUES,
  type TFieldMetaSchema as FieldMeta,
  ZFieldMetaSchema,
} from '@documenso/lib/types/field-meta';
import { prisma } from '@documenso/prisma';
import { EnvelopeType, type FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { assertFieldGroupAllowedForType, assertFieldGroupsValid } from '../../utils/field-groups';
import { mapFieldToLegacyField } from '../../utils/fields';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { assertFieldMetaValid } from './validate-field-meta';

export type SetFieldsForTemplateOptions = {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;
  fields: {
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
    /**
     * Omitted keeps the existing value, null clears it.
     */
    groupId?: string | null;
    /**
     * Omitted keeps the existing value, null clears it.
     */
    externalId?: string | null;
  }[];
};

export const setFieldsForTemplate = async ({ userId, teamId, id, fields }: SetFieldsForTemplateOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.TEMPLATE,
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

  const existingFields = envelope.fields;

  const removedFields = existingFields.filter(
    (existingField) => !fields.find((field) => field.id === existingField.id),
  );

  const linkedFields = fields.map((field) => {
    const existing = existingFields.find((existingField) => existingField.id === field.id);

    const recipient = envelope.recipients.find((recipient) => recipient.id === field.recipientId);

    // Check whether the field is being attached to an allowed envelope item.
    const foundEnvelopeItem = envelope.envelopeItems.find((envelopeItem) => envelopeItem.id === field.envelopeItemId);

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

    // An omitted value keeps the stored one, an explicit null clears it.
    const groupId = field.groupId === undefined ? (existing?.groupId ?? null) : field.groupId;
    const externalId = field.externalId === undefined ? (existing?.externalId ?? null) : field.externalId;

    assertFieldGroupAllowedForType(field.type, groupId);

    // The type of a grouped field can never be changed since it would desync the group.
    if (existing && existing.type !== field.type && (existing.groupId || groupId)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Cannot change the type of field ${existing.id} because it belongs to a group`,
      });
    }

    if (groupId && envelope.internalVersion !== 2) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Field groups are only supported for V2 envelopes',
      });
    }

    const parsedFieldMeta = field.fieldMeta
      ? ZFieldMetaSchema.parse(field.fieldMeta)
      : FIELD_META_DEFAULT_VALUES[field.type];

    assertFieldMetaValid({
      type: field.type,
      fieldMeta: field.fieldMeta,
      isGrouped: groupId !== null,
    });

    return {
      ...field,
      groupId,
      externalId,
      _parsedFieldMeta: parsedFieldMeta,
      _persisted: existing,
      _recipient: recipient,
    };
  });

  // Since this is a full replace, the payload represents the final state of every field.
  assertFieldGroupsValid(
    linkedFields.map((field) => ({
      id: field.id,
      type: field.type,
      recipientId: field.recipientId,
      groupId: field.groupId,
      fieldMeta: field._parsedFieldMeta,
    })),
  );

  const persistedFields = await Promise.all(
    // Disabling as wrapping promises here causes type issues
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    linkedFields.map(async (field) => {
      const parsedFieldMeta = field._parsedFieldMeta;

      // Proceed with upsert operation
      const upsertedField = await prisma.field.upsert({
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
          groupId: field.groupId,
          externalId: field.externalId,
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
          groupId: field.groupId,
          externalId: field.externalId,
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

      return {
        ...upsertedField,
        formId: field.formId,
      };
    }),
  );

  if (removedFields.length > 0) {
    await prisma.field.deleteMany({
      where: {
        id: {
          in: removedFields.map((field) => field.id),
        },
      },
    });
  }

  // Filter out fields that have been removed or have been updated.
  const filteredFields = existingFields.filter((field) => {
    const isRemoved = removedFields.find((removedField) => removedField.id === field.id);
    const isUpdated = persistedFields.find((persistedField) => persistedField.id === field.id);

    return !isRemoved && !isUpdated;
  });

  const mappedFilteredFields = filteredFields.map((field) => ({
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
