import type {
  TDateFieldMeta as DateFieldMeta,
  TEmailFieldMeta as EmailFieldMeta,
  TInitialsFieldMeta as InitialsFieldMeta,
  TNameFieldMeta as NameFieldMeta,
} from '../types/field-meta';

export const validateFields = (
  fieldMeta: DateFieldMeta | EmailFieldMeta | InitialsFieldMeta | NameFieldMeta,
): string[] => {
  const errors = [];
  const { fontSize } = fieldMeta;

  if (fontSize && (fontSize < 8 || fontSize > 96)) {
    errors.push('Font size must be between 8 and 96.');
  }

  return errors;
};
