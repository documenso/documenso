import { numberFormatValues } from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';

import type { TNumberFieldMeta as NumberFieldMeta } from '../types/field-meta';

export const validateNumberField = (
  value: string,
  fieldMeta?: NumberFieldMeta,
  isSigningPage: boolean = false,
): string[] => {
  const errors = [];

  const { minValue, maxValue, readOnly, required, numberFormat, fontSize } = fieldMeta || {};

  if (numberFormat && value.length > 0) {
    const foundRegex = numberFormatValues.find((item) => item.value === numberFormat)?.regex;

    if (!foundRegex) {
      errors.push(`Invalid number format - ${numberFormat}`);
    }

    if (foundRegex && !foundRegex.test(value)) {
      errors.push(`Value ${value} does not match the number format - ${numberFormat}`);
    }
  }

  const numberValue = parseFloat(value);

  if (isSigningPage && required && !value) {
    errors.push('Value is required');
  }

  if ((isSigningPage || value.length > 0) && !/^[0-9,.]+$/.test(value.trim())) {
    errors.push(`Value is not a valid number`);
  }

  if (typeof minValue === 'number' && minValue > 0 && numberValue < minValue) {
    errors.push(`Value ${value} is less than the minimum value of ${minValue}`);
  }

  if (typeof maxValue === 'number' && maxValue > 0 && numberValue > maxValue) {
    errors.push(`Value ${value} is greater than the maximum value of ${maxValue}`);
  }

  if (typeof minValue === 'number' && typeof maxValue === 'number' && minValue > maxValue) {
    errors.push('Minimum value cannot be greater than maximum value');
  }

  if (typeof maxValue === 'number' && typeof minValue === 'number' && maxValue < minValue) {
    errors.push('Maximum value cannot be less than minimum value');
  }

  if (readOnly && numberValue < 1) {
    errors.push('A read-only field must have a value greater than 0');
  }

  if (readOnly && required) {
    errors.push('A field cannot be both read-only and required');
  }

  if (fontSize && (fontSize < 8 || fontSize > 96)) {
    errors.push('Font size must be between 8 and 96.');
  }

  return errors;
};
