import { validateCheckboxField } from '@documenso/lib/advanced-fields-validation/validate-checkbox';
import { validateDropdownField } from '@documenso/lib/advanced-fields-validation/validate-dropdown';
import { validateNumberField } from '@documenso/lib/advanced-fields-validation/validate-number';
import { validateRadioField } from '@documenso/lib/advanced-fields-validation/validate-radio';
import { validateTextField } from '@documenso/lib/advanced-fields-validation/validate-text';
import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import { FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';

type ValidateFieldMetaOptions = {
  type: FieldType;
  fieldMeta: unknown;
  /**
   * Grouped checkbox and radio fields are validated as a pool via
   * `assertFieldGroupsValid` instead of individually, since validation rules
   * apply to the combined options of the whole group.
   */
  groupId?: string | null;
};

/**
 * Validates the field meta for a single field prior to persisting it.
 *
 * @throws AppError if the field meta is invalid.
 */
export const assertFieldMetaValid = ({ type, fieldMeta, groupId }: ValidateFieldMetaOptions): void => {
  const errors: string[] = [];
  const isGrouped = Boolean(groupId);

  if (type === FieldType.TEXT && fieldMeta) {
    const textFieldParsedMeta = ZTextFieldMeta.parse(fieldMeta);

    errors.push(...validateTextField(textFieldParsedMeta.text || '', textFieldParsedMeta));
  }

  if (type === FieldType.NUMBER && fieldMeta) {
    const numberFieldParsedMeta = ZNumberFieldMeta.parse(fieldMeta);

    errors.push(...validateNumberField(String(numberFieldParsedMeta.value || ''), numberFieldParsedMeta, false));
  }

  if (type === FieldType.CHECKBOX) {
    if (!fieldMeta) {
      errors.push('To proceed further, please set at least one value for the Checkbox field');
    } else if (!isGrouped) {
      const checkboxFieldParsedMeta = ZCheckboxFieldMeta.parse(fieldMeta);

      errors.push(
        ...validateCheckboxField(
          checkboxFieldParsedMeta?.values?.map((item) => item.value) ?? [],
          checkboxFieldParsedMeta,
        ),
      );
    }
  }

  if (type === FieldType.RADIO) {
    if (!fieldMeta) {
      errors.push('To proceed further, please set at least one value for the Radio field');
    } else if (!isGrouped) {
      const radioFieldParsedMeta = ZRadioFieldMeta.parse(fieldMeta);
      const checkedRadioFieldValue = radioFieldParsedMeta.values?.find((option) => option.checked)?.value;

      errors.push(...validateRadioField(checkedRadioFieldValue, radioFieldParsedMeta));
    }
  }

  if (type === FieldType.DROPDOWN) {
    if (!fieldMeta) {
      errors.push('To proceed further, please set at least one value for the Dropdown field');
    } else {
      const dropdownFieldParsedMeta = ZDropdownFieldMeta.parse(fieldMeta);

      errors.push(...validateDropdownField(undefined, dropdownFieldParsedMeta));
    }
  }

  if (errors.length > 0) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: errors.join('. '),
      userMessage: errors.join('. '),
    });
  }
};
