import { validateDropdownField } from '@documenso/lib/advanced-fields-validation/validate-dropdown';
import { validateNumberField } from '@documenso/lib/advanced-fields-validation/validate-number';
import { validateTextField } from '@documenso/lib/advanced-fields-validation/validate-text';
import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { isBase64Image } from '@documenso/lib/constants/signatures';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TDocumentMeta } from '@documenso/lib/types/document-meta';
import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import { parseCheckboxCustomText, toCheckboxCustomText, toRadioCustomText } from '@documenso/lib/utils/fields';
import { zEmail } from '@documenso/lib/utils/zod';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import type { Field } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { DateTime } from 'luxon';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

export type ExtractFieldInsertionValuesOptions = {
  fieldValue: TSignEnvelopeFieldValue;
  field: Field;
  documentMeta: Pick<TDocumentMeta, 'timezone' | 'dateFormat' | 'typedSignatureEnabled'>;
};

export const extractFieldInsertionValues = ({
  fieldValue,
  field,
  documentMeta,
}: ExtractFieldInsertionValuesOptions): { customText: string; inserted: boolean } => {
  return match(fieldValue)
    .with({ type: FieldType.EMAIL }, (fieldValue) => {
      const parsedEmailValue = zEmail().nullable().safeParse(fieldValue.value);

      if (!parsedEmailValue.success) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Invalid email',
        });
      }

      if (parsedEmailValue.data === null) {
        return {
          customText: '',
          inserted: false,
        };
      }

      return {
        customText: parsedEmailValue.data,
        inserted: true,
      };
    })
    .with({ type: P.union(FieldType.NAME, FieldType.INITIALS) }, (fieldValue) => {
      const parsedGenericStringValue = z.string().min(1).nullable().safeParse(fieldValue.value);

      if (!parsedGenericStringValue.success) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Value is required',
        });
      }

      if (parsedGenericStringValue.data === null) {
        return {
          customText: '',
          inserted: false,
        };
      }

      return {
        customText: parsedGenericStringValue.data,
        inserted: true,
      };
    })
    .with({ type: FieldType.DATE }, (fieldValue) => {
      if (!fieldValue.value) {
        return {
          customText: '',
          inserted: false,
        };
      }

      return {
        customText: DateTime.now()
          .setZone(documentMeta.timezone ?? DEFAULT_DOCUMENT_TIME_ZONE)
          .toFormat(documentMeta.dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT),
        inserted: true,
      };
    })
    .with({ type: FieldType.NUMBER }, (fieldValue) => {
      if (!fieldValue.value) {
        return {
          customText: '',
          inserted: false,
        };
      }

      const numberFieldParsedMeta = ZNumberFieldMeta.parse(field.fieldMeta);
      const errors = validateNumberField(fieldValue.value, numberFieldParsedMeta, true);

      if (errors.length > 0) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Invalid number',
        });
      }

      return {
        customText: fieldValue.value,
        inserted: true,
      };
    })
    .with({ type: FieldType.TEXT }, (fieldValue) => {
      if (fieldValue.value === null) {
        return {
          customText: '',
          inserted: false,
        };
      }

      const parsedTextFieldMeta = ZTextFieldMeta.parse(field.fieldMeta);
      const errors = validateTextField(fieldValue.value, parsedTextFieldMeta, true);

      if (errors.length > 0) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Invalid email',
        });
      }

      return {
        customText: fieldValue.value,
        inserted: true,
      };
    })
    .with({ type: FieldType.RADIO }, (fieldValue) => {
      if (fieldValue.value === null) {
        return {
          customText: '',
          inserted: false,
        };
      }

      const parsedRadioFieldParsedMeta = ZRadioFieldMeta.parse(field.fieldMeta);
      const radioFieldValues = parsedRadioFieldParsedMeta.values || [];

      if (!radioFieldValues[fieldValue.value]) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Invalid radio value',
        });
      }

      return {
        customText: toRadioCustomText(fieldValue.value),
        inserted: true,
      };
    })
    .with({ type: FieldType.CHECKBOX }, (fieldValue) => {
      if (fieldValue.value === null || fieldValue.value.length === 0) {
        return {
          customText: '',
          inserted: false,
        };
      }

      const parsedCheckboxFieldParsedMeta = ZCheckboxFieldMeta.parse(field.fieldMeta);
      const checkboxFieldValues = parsedCheckboxFieldParsedMeta.values || [];

      const { value } = fieldValue;

      const selectedValues = value.map((valueIndex) => checkboxFieldValues[valueIndex]);

      if (selectedValues.some((value) => !value)) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Invalid checkbox values',
        });
      }

      // The validation rule is deliberately not enforced here. Recipients may select
      // any options while signing, and the rule is enforced when they complete the document.
      return {
        customText: toCheckboxCustomText(fieldValue.value),
        inserted: true,
      };
    })
    .with({ type: FieldType.DROPDOWN }, (fieldValue) => {
      if (fieldValue.value === null) {
        return {
          customText: '',
          inserted: false,
        };
      }

      const parsedDropdownFieldMeta = ZDropdownFieldMeta.parse(field.fieldMeta);
      const errors = validateDropdownField(fieldValue.value, parsedDropdownFieldMeta, true);

      if (errors.length > 0) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Invalid dropdown value',
        });
      }

      return {
        customText: fieldValue.value,
        inserted: true,
      };
    })
    .with({ type: FieldType.SIGNATURE }, (fieldValue) => {
      const { value } = fieldValue;

      if (!value) {
        return {
          customText: '',
          inserted: false,
        };
      }

      const isBase64 = isBase64Image(value);

      if (documentMeta.typedSignatureEnabled === false && !isBase64) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Typed signatures are not allowed. Please draw your signature',
        });
      }

      return {
        customText: '',
        inserted: true,
      };
    })
    .exhaustive();
};

export type FieldInsertionValues = {
  fieldId: number;
  customText: string;
  inserted: boolean;
};

export type ExtractGroupedRadioInsertionValuesOptions = {
  /**
   * Every field in the group.
   */
  fields: Field[];
  /**
   * The field which the option was selected on.
   */
  selectedFieldId: number;
  /**
   * The index of the selected option on the selected field, or null to uninsert the group.
   */
  selectedIndex: number | null;
};

/**
 * Resolves the insertion values for a group of radio fields.
 *
 * Only one option can be selected across the group, so selecting an option on one
 * field clears every other field. Every member is marked as inserted once the group
 * has a selection so the group is treated as a single answered field.
 */
export const extractGroupedRadioInsertionValues = ({
  fields,
  selectedFieldId,
  selectedIndex,
}: ExtractGroupedRadioInsertionValuesOptions): FieldInsertionValues[] => {
  const selectedField = fields.find((field) => field.id === selectedFieldId);

  if (!selectedField) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Field ${selectedFieldId} not found in group`,
    });
  }

  if (selectedIndex === null) {
    return fields.map((field) => ({
      fieldId: field.id,
      customText: '',
      inserted: false,
    }));
  }

  const parsedRadioFieldMeta = ZRadioFieldMeta.parse(selectedField.fieldMeta);
  const radioFieldValues = parsedRadioFieldMeta.values || [];

  if (!radioFieldValues[selectedIndex]) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Invalid radio value',
    });
  }

  return fields.map((field) => ({
    fieldId: field.id,
    customText: field.id === selectedFieldId ? toRadioCustomText(selectedIndex) : '',
    inserted: true,
  }));
};

export type ExtractGroupedCheckboxInsertionValuesOptions = {
  /**
   * Every field in the group.
   */
  fields: Field[];
  /**
   * The selected option indices for the fields which have changed. Fields not included
   * keep their current selection.
   */
  fieldValues: { fieldId: number; value: number[] }[];
};

/**
 * Resolves the insertion values for a group of checkbox fields.
 *
 * Every member is marked as inserted once the group has any selection so the group is
 * treated as a single answered field.
 */
export const extractGroupedCheckboxInsertionValues = ({
  fields,
  fieldValues,
}: ExtractGroupedCheckboxInsertionValuesOptions): FieldInsertionValues[] => {
  if (fields.length === 0) {
    return [];
  }

  const selectedIndicesByFieldId = new Map(fieldValues.map(({ fieldId, value }) => [fieldId, value]));

  for (const fieldId of selectedIndicesByFieldId.keys()) {
    if (!fields.some((field) => field.id === fieldId)) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Field ${fieldId} not found in group`,
      });
    }
  }

  const memberSelections = fields.map((field) => {
    const parsedCheckboxFieldMeta = ZCheckboxFieldMeta.parse(field.fieldMeta);
    const checkboxFieldValues = parsedCheckboxFieldMeta.values || [];

    const selectedIndices =
      selectedIndicesByFieldId.get(field.id) ?? (field.customText ? parseCheckboxCustomText(field.customText) : []);

    if (selectedIndices.some((index) => !checkboxFieldValues[index])) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Invalid checkbox values',
      });
    }

    return {
      field,
      selectedIndices,
    };
  });

  const pooledSelectedCount = memberSelections.reduce(
    (total, { selectedIndices }) => total + selectedIndices.length,
    0,
  );

  if (pooledSelectedCount === 0) {
    return fields.map((field) => ({
      fieldId: field.id,
      customText: '',
      inserted: false,
    }));
  }

  // The validation rule is deliberately not enforced here. Recipients may select any
  // options while signing, and the rule is enforced when they complete the document.
  return memberSelections.map(({ field, selectedIndices }) => ({
    fieldId: field.id,
    customText: selectedIndices.length > 0 ? toCheckboxCustomText(selectedIndices) : '',
    inserted: true,
  }));
};
