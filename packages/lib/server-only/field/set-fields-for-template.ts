import { EnvelopeType, FieldType } from '@prisma/client';

import { validateCheckboxField } from '@documenso/lib/advanced-fields-validation/validate-checkbox';
import { validateDropdownField } from '@documenso/lib/advanced-fields-validation/validate-dropdown';
import { validateNumberField } from '@documenso/lib/advanced-fields-validation/validate-number';
import { validateRadioField } from '@documenso/lib/advanced-fields-validation/validate-radio';
import { validateTextField } from '@documenso/lib/advanced-fields-validation/validate-text';
import {
  type TFieldMetaSchema as FieldMeta,
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZFieldMetaSchema,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { mapFieldToLegacyField } from '../../utils/fields';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

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
  }[];
};

export const setFieldsForTemplate = async ({
  userId,
  teamId,
  id,
  fields,
}: SetFieldsForTemplateOptions) => {
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

    return {
      ...field,
      _persisted: existing,
      _recipient: recipient,
    };
  });

  const persistedFields = await Promise.all(
    // Disabling as wrapping promises here causes type issues
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    linkedFields.map(async (field) => {
      const parsedFieldMeta = field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : undefined;

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
        );
        if (errors.length > 0) {
          throw new Error(errors.join(', '));
        }
      }

      if (field.type === FieldType.CHECKBOX) {
        if (!field.fieldMeta) {
          throw new Error('Checkbox field is missing required metadata');
        }
        const checkboxFieldParsedMeta = ZCheckboxFieldMeta.parse(field.fieldMeta);
        const errors = validateCheckboxField(
          checkboxFieldParsedMeta?.values?.map((item) => item.value) ?? [],
          checkboxFieldParsedMeta,
        );
        if (errors.length > 0) {
          throw new Error(errors.join(', '));
        }
      }

      if (field.type === FieldType.RADIO) {
        if (!field.fieldMeta) {
          throw new Error('Radio field is missing required metadata');
        }
        const radioFieldParsedMeta = ZRadioFieldMeta.parse(field.fieldMeta);
        const checkedRadioFieldValue = radioFieldParsedMeta.values?.find(
          (option) => option.checked,
        )?.value;
        const errors = validateRadioField(checkedRadioFieldValue, radioFieldParsedMeta);
        if (errors.length > 0) {
          throw new Error(errors.join('. '));
        }
      }

      if (field.type === FieldType.DROPDOWN) {
        if (!field.fieldMeta) {
          throw new Error('Dropdown field is missing required metadata');
        }
        const dropdownFieldParsedMeta = ZDropdownFieldMeta.parse(field.fieldMeta);
        const errors = validateDropdownField(undefined, dropdownFieldParsedMeta);
        if (errors.length > 0) {
          throw new Error(errors.join('. '));
        }
      }

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
