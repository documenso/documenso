// import { numberFormatValues } from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';
import type { TNumberFieldMeta as NumberFieldMeta } from '../types/field-meta';

export const validateNumberField = (
  value: string,
  fieldMeta?: NumberFieldMeta,
  isSigningPage: boolean = false,
): string[] => {
  const errors = [];

  const { minValue, maxValue, readOnly, required, numberFormat, fontSize } = fieldMeta || {};

  const formatRegex: { [key: string]: RegExp } = {
    '123,456,789.00': /^(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?$/,
    '123.456.789,00': /^(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{1,2})?$/,
    '123456,789.00': /^(?:\d+)(?:,\d{1,3}(?:\.\d{1,2})?)?$/,
  };

  const isValidFormat = numberFormat ? formatRegex[numberFormat].test(value) : true;

  if (!isValidFormat) {
    errors.push(`Value ${value} does not match the number format - ${numberFormat}`);
  }

  const numberValue = parseFloat(value);

  if (isSigningPage && required && !value) {
    errors.push('Value is required');
  }

  if (!/^[0-9,.]+$/.test(value.trim())) {
    errors.push(`Value is not a valid number`);
  }

  if (minValue !== undefined && minValue > 0 && numberValue < minValue) {
    errors.push(`Value ${value} is less than the minimum value of ${minValue}`);
  }

  if (maxValue !== undefined && maxValue > 0 && numberValue > maxValue) {
    errors.push(`Value ${value} is greater than the maximum value of ${maxValue}`);
  }

  if (minValue !== undefined && maxValue !== undefined && minValue > maxValue) {
    errors.push('Minimum value cannot be greater than maximum value');
  }

  if (maxValue !== undefined && minValue !== undefined && maxValue < minValue) {
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
