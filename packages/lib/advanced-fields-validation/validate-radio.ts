import type { TRadioFieldMeta as RadioFieldMeta } from '../types/field-meta';

export const validateRadioField = (
  value: string | undefined,
  fieldMeta: RadioFieldMeta,
  isSigningPage: boolean = false,
): string[] => {
  const errors = [];

  const { readOnly, required, values } = fieldMeta;

  if (readOnly && required) {
    errors.push('A field cannot be both read-only and required');
  }

  if (readOnly && (!values || values.length === 0)) {
    errors.push('A read-only field must have at least one value');
  }

  if (isSigningPage && required && !value) {
    errors.push('Choosing an option is required');
  }

  if (values) {
    const checkedRadioFieldValues = values.filter((option) => option.checked);

    if (values.length === 0) {
      errors.push('Radio field must have at least one option');
    }

    if (checkedRadioFieldValues.length > 1) {
      errors.push('There cannot be more than one checked option');
    }
  }

  return errors;
};
