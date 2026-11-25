import { checkboxValidationSigns } from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';
import type { Field } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { isDeepEqual } from 'remeda';
import { match } from 'ts-pattern';

import { validateCheckboxField, validateCheckboxLength } from '../advanced-fields-validation/validate-checkbox';
import { validateDropdownField } from '../advanced-fields-validation/validate-dropdown';
import { validateNumberField } from '../advanced-fields-validation/validate-number';
import { validateRadioField } from '../advanced-fields-validation/validate-radio';
import { validateTextField } from '../advanced-fields-validation/validate-text';
import { AUTO_SIGNABLE_FIELD_TYPES } from '../constants/autosign';
import { AppError, AppErrorCode } from '../errors/app-error';
import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '../types/field-meta';
import { fromCheckboxValue, toCheckboxValue } from '../universal/field-checkbox';

type LegacyOption = {
  id: number;
  value: string;
};

export type AssertLegacyFieldValueAllowedOptions = {
  field: Pick<Field, 'type' | 'fieldMeta'>;
  value: string;
  isBase64?: boolean;
  typedSignatureEnabled?: boolean | null;
};

/** Shared by V1 signing and V1 direct links, so both accept exactly the same values. */
export const assertLegacyFieldValueAllowed = ({
  field,
  value,
  isBase64,
  typedSignatureEnabled,
}: AssertLegacyFieldValueAllowedOptions) => {
  const { type, fieldMeta } = field;

  // A read only value must equal the sender's value (checked below), which is signed as stored
  // even if it no longer passes the number rules.
  if (type === FieldType.NUMBER && fieldMeta && !fieldMeta.readOnly) {
    assertNoErrors(validateNumberField(value, ZNumberFieldMeta.parse(fieldMeta), true));
  }

  if (type === FieldType.TEXT && fieldMeta) {
    assertNoErrors(validateTextField(value, ZTextFieldMeta.parse(fieldMeta), true));
  }

  if (type === FieldType.CHECKBOX && fieldMeta) {
    const checkboxFieldMeta = ZCheckboxFieldMeta.parse(fieldMeta);
    const checkedValues = fromCheckboxValue(value);

    assertNoErrors(validateCheckboxField(checkedValues, checkboxFieldMeta, true));

    const options = checkboxFieldMeta.values ?? [];

    // Each value may appear once per option carrying it, so a value cannot be repeated to meet
    // the count rule, while options sharing a label can still all be checked.
    const isEachValueAnOption = checkedValues.every((checkedValue) => {
      const submittedCount = checkedValues.filter((value) => value === checkedValue).length;
      const optionCount = options.filter((option) => isLegacyOptionValue(option, checkedValue)).length;

      return submittedCount <= optionCount;
    });

    if (!isEachValueAnOption) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Selected values must be among the available options',
      });
    }
  }

  if (type === FieldType.RADIO && fieldMeta) {
    const radioFieldMeta = ZRadioFieldMeta.parse(fieldMeta);

    assertNoErrors(validateRadioField(value, radioFieldMeta, true));

    if (value && !radioFieldMeta.values?.some((option) => isLegacyOptionValue(option, value))) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Selected value must be one of the available options',
      });
    }
  }

  if (type === FieldType.DROPDOWN && fieldMeta) {
    assertNoErrors(validateDropdownField(value, ZDropdownFieldMeta.parse(fieldMeta), true));
  }

  const isSignatureField = type === FieldType.SIGNATURE || type === FieldType.FREE_SIGNATURE;

  if (isSignatureField && !value) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Signature field must have a signature',
    });
  }

  if (isSignatureField && typedSignatureEnabled === false && !isBase64) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Typed signatures are not allowed. Please draw your signature',
    });
  }

  if (fieldMeta?.readOnly && !AUTO_SIGNABLE_FIELD_TYPES.includes(type)) {
    const customText = isSignatureField ? undefined : value;

    const isSenderValue = match(fieldMeta)
      .with({ type: 'text' }, (meta) => customText === meta.text)
      .with({ type: 'number' }, (meta) => customText === meta.value)
      .with({ type: 'checkbox' }, (meta) =>
        isDeepEqual(
          fromCheckboxValue(customText ?? ''),
          meta.values?.filter((v) => v.checked).map(toLegacyOptionValue) ?? [],
        ),
      )
      .with({ type: 'radio' }, (meta) => {
        const checkedOption = meta.values?.find((v) => v.checked);

        return checkedOption !== undefined && customText === toLegacyOptionValue(checkedOption);
      })
      .with({ type: 'dropdown' }, (meta) => customText === meta.defaultValue)
      .otherwise(() => false);

    if (!isSenderValue) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Field is read only and only accepts its default value for signing.',
      });
    }
  }
};

/**
 * The value the legacy signing page sends for a read only field, built from the sender's value.
 * Null when it sends nothing.
 */
export const getLegacyReadOnlyFieldValue = (field: Pick<Field, 'type' | 'fieldMeta'>): string | null => {
  const { type, fieldMeta } = field;

  if (!fieldMeta?.readOnly || AUTO_SIGNABLE_FIELD_TYPES.includes(type)) {
    return null;
  }

  const value = match(fieldMeta)
    .with({ type: 'text' }, (meta) => meta.text)
    .with({ type: 'number' }, (meta) => meta.value)
    .with({ type: 'dropdown' }, (meta) => meta.defaultValue)
    .with({ type: 'radio' }, (meta) => {
      const checkedOption = meta.values?.find((option) => option.checked);

      return checkedOption ? toLegacyOptionValue(checkedOption) : undefined;
    })
    .with({ type: 'checkbox' }, (meta) => {
      const checkedValues = (meta.values ?? []).filter((option) => option.checked).map(toLegacyOptionValue);

      const validation = checkboxValidationSigns.find((sign) => sign.label === meta.validationRule);

      // The page does not send pre-checked options which break the field's own rule.
      if (validation && !validateCheckboxLength(checkedValues.length, validation.value, meta.validationLength ?? 0)) {
        return undefined;
      }

      return checkedValues.length > 0 ? toCheckboxValue(checkedValues) : undefined;
    })
    .otherwise(() => undefined);

  return value || null;
};

const assertNoErrors = (errors: string[]) => {
  if (errors.length > 0) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: errors.join(', '),
    });
  }
};

// The legacy signing page sends an option without a label as this placeholder.
const toLegacyOptionValue = (option: LegacyOption) =>
  option.value.length > 0 ? option.value : `empty-value-${option.id}`;

// The signing route trims the value it receives, so a radio option starting or ending in a
// space arrives without it.
const isLegacyOptionValue = (option: LegacyOption, value: unknown) => {
  const optionValue = toLegacyOptionValue(option);

  return value === optionValue || value === optionValue.trim();
};
