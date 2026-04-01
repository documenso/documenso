import { FieldType } from '@prisma/client';

import { validateCheckboxLength } from '@documenso/lib/advanced-fields-validation/validate-checkbox';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldCheckbox } from '@documenso/lib/types/field';
import { parseCheckboxCustomText } from '@documenso/lib/utils/fields';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { checkboxValidationSigns } from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';

import { SignFieldCheckboxDialog } from '~/components/dialogs/sign-field-checkbox-dialog';

type HandleCheckboxFieldClickOptions = {
  field: TFieldCheckbox;
  clickedCheckboxIndex: number;
};

export const handleCheckboxFieldClick = async (
  options: HandleCheckboxFieldClickOptions,
): Promise<Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.CHECKBOX }> | null> => {
  const { field, clickedCheckboxIndex } = options;

  if (field.type !== FieldType.CHECKBOX) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  const { values = [], validationRule, validationLength } = field.fieldMeta;
  const { customText } = field;

  const currentCheckedIndices: number[] = customText ? parseCheckboxCustomText(customText) : [];

  const newValues = values.map((_value, i) => {
    let isChecked = currentCheckedIndices.includes(i);

    if (i === clickedCheckboxIndex) {
      isChecked = !isChecked;
    }

    return {
      index: i,
      isChecked,
    };
  });

  let checkedValues: number[] | null = newValues.filter((v) => v.isChecked).map((v) => v.index);

  if (checkedValues.length === 0) {
    return {
      type: FieldType.CHECKBOX,
      value: [],
    };
  }

  if (validationRule && validationLength) {
    const checkboxValidationRule = checkboxValidationSigns.find(
      (sign) => sign.label === validationRule,
    );

    if (!checkboxValidationRule) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Invalid checkbox validation rule',
      });
    }

    // Custom logic to make it flow better.
    // If "at most" OR "exactly" 1 value then just return the new selected value if exists.
    if (
      (checkboxValidationRule.value === '=' || checkboxValidationRule.value === '<=') &&
      validationLength === 1
    ) {
      return {
        type: FieldType.CHECKBOX,
        value: [clickedCheckboxIndex],
      };
    }

    const isValid = validateCheckboxLength(
      checkedValues.length,
      checkboxValidationRule.value,
      validationLength,
    );

    // Only render validation dialog if validation is invalid.
    if (!isValid) {
      checkedValues = await SignFieldCheckboxDialog.call({
        fieldMeta: field.fieldMeta,
        validationRule: checkboxValidationRule.value,
        validationLength,
        preselectedIndices: checkedValues,
      });
    }
  }

  if (!checkedValues) {
    return null;
  }

  return {
    type: FieldType.CHECKBOX,
    value: checkedValues,
  };
};
