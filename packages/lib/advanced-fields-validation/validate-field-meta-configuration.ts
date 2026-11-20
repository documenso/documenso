import { match } from 'ts-pattern';

import type { TFieldMetaSchema } from '../types/field-meta';
import { validateCheckboxField } from './validate-checkbox';
import { validateDropdownField } from './validate-dropdown';
import { validateNumberField } from './validate-number';
import { validateRadioField } from './validate-radio';
import { validateTextField } from './validate-text';

/**
 * Validates the configuration of a field's meta using the same rules the editor and the
 * V1 `setFieldsForDocument` path apply, so the API cannot persist a configuration the
 * signing page would later reject (e.g. a field that is both required and read-only).
 *
 * Returns the list of validation errors, empty when the configuration is valid.
 */
export const validateFieldMetaConfiguration = (fieldMeta: TFieldMetaSchema): string[] => {
  if (!fieldMeta) {
    return [];
  }

  return match(fieldMeta)
    .with({ type: 'text' }, (meta) => validateTextField(meta.text || '', meta))
    .with({ type: 'number' }, (meta) => validateNumberField(String(meta.value || ''), meta))
    .with({ type: 'checkbox' }, (meta) => validateCheckboxField(meta.values?.map((option) => option.value) ?? [], meta))
    .with({ type: 'radio' }, (meta) => validateRadioField(meta.values?.find((option) => option.checked)?.value, meta))
    .with({ type: 'dropdown' }, (meta) => validateDropdownField(undefined, meta))
    .otherwise(() => []);
};
