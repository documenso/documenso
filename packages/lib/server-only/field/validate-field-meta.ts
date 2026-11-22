import { validateCheckboxField } from '@documenso/lib/advanced-fields-validation/validate-checkbox';
import { validateDropdownField } from '@documenso/lib/advanced-fields-validation/validate-dropdown';
import { validateNumberField } from '@documenso/lib/advanced-fields-validation/validate-number';
import { validateRadioField } from '@documenso/lib/advanced-fields-validation/validate-radio';
import { validateTextField } from '@documenso/lib/advanced-fields-validation/validate-text';
import type { TFieldMetaNotOptionalSchema, TFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { FieldType } from '@prisma/client';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '../../errors/app-error';

const FIELD_META_REQUIRED_LABELS: Partial<Record<FieldType, string>> = {
  [FieldType.CHECKBOX]: 'Checkbox',
  [FieldType.RADIO]: 'Radio',
  [FieldType.DROPDOWN]: 'Dropdown',
};

/**
 * Rejects a checkbox, radio or dropdown field saved without field meta, since its options are
 * stored there. The V1 editor's autosave can send one before its options are set, and falling
 * back to the default meta would store an option with no label.
 *
 * Only used for V1 envelopes. V2 envelopes fall back to the default meta, which is what the V2
 * editor creates for a new field anyway.
 */
export const assertFieldMetaProvided = (type: FieldType, fieldMeta: TFieldMetaSchema | null | undefined): void => {
  const label = FIELD_META_REQUIRED_LABELS[type];

  if (fieldMeta || !label) {
    return;
  }

  throw new AppError(AppErrorCode.INVALID_REQUEST, {
    message: `To proceed further, please set at least one value for the ${label} field`,
    userMessage: `To proceed further, please set at least one value for the ${label} field`,
  });
};

type ValidateFieldMetaOptions = {
  type: FieldType;
  fieldMeta: TFieldMetaNotOptionalSchema;
  /**
   * Grouped checkbox and radio fields are validated as a whole group via
   * `assertFieldGroupsValid` instead of individually, since validation rules
   * apply to the options across the whole group.
   */
  groupId?: string | null;
  fieldId?: number;
  /**
   * For V1 compat. Meta for a different field type is left unvalidated.
   */
  allowTypeMismatch?: boolean;
};

/**
 * Validates the field meta for a single field prior to persisting it, so a configuration the
 * signing page would later reject (e.g. a field that is both required and read-only) is never stored.
 *
 * @throws AppError if the field meta is invalid.
 */
export const assertFieldMetaValid = ({
  type,
  fieldMeta,
  groupId,
  fieldId,
  allowTypeMismatch = false,
}: ValidateFieldMetaOptions): void => {
  if (fieldMeta.type !== type.toLowerCase()) {
    if (allowTypeMismatch) {
      return;
    }

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Field meta type does not match the field type',
    });
  }

  const isGrouped = Boolean(groupId);

  const errors = match(fieldMeta)
    .with({ type: 'text' }, (meta) => validateTextField(meta.text || '', meta))
    .with({ type: 'number' }, (meta) => validateNumberField(String(meta.value || ''), meta))
    .with({ type: 'checkbox' }, (meta) =>
      isGrouped ? [] : validateCheckboxField(meta.values?.map((option) => option.value) ?? [], meta),
    )
    .with({ type: 'radio' }, (meta) =>
      isGrouped ? [] : validateRadioField(meta.values?.find((option) => option.checked)?.value, meta),
    )
    .with({ type: 'dropdown' }, (meta) => validateDropdownField(undefined, meta))
    .otherwise(() => []);

  if (errors.length > 0) {
    const fieldDescription = fieldId === undefined ? `${type} field` : `${type} field ${fieldId}`;

    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Invalid field meta for ${fieldDescription}: ${errors.join('. ')}`,
      userMessage: errors.join('. '),
    });
  }
};
