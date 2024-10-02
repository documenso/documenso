import type { TTextFieldMeta as TextFieldMeta } from '../types/field-meta';

export const validateTextField = (
  value: string,
  fieldMeta: TextFieldMeta,
  isSigningPage: boolean = false,
): string[] => {
  const errors = [];

  const { characterLimit, readOnly, required, fontSize } = fieldMeta;

  if (required && !value && isSigningPage) {
    errors.push('Value is required');
  }

  if (characterLimit !== undefined && characterLimit > 0 && value.length > characterLimit) {
    errors.push(`Value length (${value.length}) exceeds the character limit (${characterLimit})`);
  }

  if (readOnly && value.length < 1) {
    errors.push('A read-only field must have text');
  }

  if (readOnly && required) {
    errors.push('A field cannot be both read-only and required');
  }

  // TODO: Not sure of the right number or if it is needed in the first place
  if (fontSize && fontSize < 8) {
    errors.push('Font size must be at least 8');
  }

  return errors;
};
