import { numberFormatValues } from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';

import type { TNumberFieldMeta as NumberFieldMeta } from '../types/field-meta';

/**
 * The smallest and largest number a value can be read as, or null when it is not a number.
 *
 * Without a format, ',' and '.' can each be the decimal separator, so `1.500` is both 1.5 and
 * 1500. The value is stored as typed, so a limit must hold for every reading: check a maximum
 * against `max` and a minimum against `min`.
 */
export const parseNumberFieldValue = (value: string, numberFormat?: string | null): NumberFieldReadings | null => {
  const format = numberFormatValues.find((item) => item.value === numberFormat);

  // A trailing separator matches only one notation, which would hide the other reading:
  // `1,500.` is still 1.5 or 1500.
  const readings = format
    ? readNumbers(value, [format])
    : readNumbers(value.trim().replace(/[.,]$/, ''), UNFORMATTED_NOTATIONS);

  if (readings.length === 0) {
    return null;
  }

  return {
    min: Math.min(...readings),
    max: Math.max(...readings),
  };
};

export const validateNumberField = (
  value: string,
  fieldMeta?: NumberFieldMeta,
  isSigningPage: boolean = false,
): string[] => {
  const errors = validateNumberFieldValue(value, fieldMeta, isSigningPage);

  const { minValue, maxValue, readOnly, required, fontSize } = fieldMeta || {};

  if (typeof minValue === 'number' && typeof maxValue === 'number' && minValue > maxValue) {
    errors.push('Minimum value cannot be greater than maximum value');
  }

  if (typeof maxValue === 'number' && typeof minValue === 'number' && maxValue < minValue) {
    errors.push('Maximum value cannot be less than minimum value');
  }

  if (readOnly && required) {
    errors.push('A field cannot be both read-only and required');
  }

  if (fontSize && (fontSize < 8 || fontSize > 96)) {
    errors.push('Font size must be between 8 and 96.');
  }

  return errors;
};

export const validateNumberFieldValue = (
  value: string,
  fieldMeta?: NumberFieldMeta,
  isSigningPage: boolean = false,
): string[] => {
  const errors = [];

  const { minValue, maxValue, readOnly, required, numberFormat } = fieldMeta || {};

  const readings = parseNumberFieldValue(value, numberFormat);

  const isKnownFormat = numberFormatValues.some((item) => item.value === numberFormat);
  const isOutsideFormat = Boolean(numberFormat) && isKnownFormat && value.length > 0 && readings === null;

  if (numberFormat && value.length > 0 && !isKnownFormat) {
    errors.push(`Invalid number format - ${numberFormat}`);
  }

  if (isOutsideFormat) {
    errors.push(`Value ${value} does not match the number format - ${numberFormat}`);
  }

  if (isSigningPage && required && !value) {
    errors.push('Value is required');
  }

  if ((isSigningPage || value.length > 0) && readings === null && !isOutsideFormat) {
    errors.push(`Value is not a valid number`);
  }

  if (readings === null) {
    return errors;
  }

  let hasReadingsOnBothSidesOfALimit = false;

  if (typeof minValue === 'number' && minValue > 0 && readings.min < minValue) {
    if (readings.max < minValue) {
      errors.push(`Value ${value} is less than the minimum value of ${minValue}`);
    } else {
      hasReadingsOnBothSidesOfALimit = true;
    }
  }

  if (typeof maxValue === 'number' && maxValue > 0 && readings.max > maxValue) {
    if (readings.min > maxValue) {
      errors.push(`Value ${value} is greater than the maximum value of ${maxValue}`);
    } else {
      hasReadingsOnBothSidesOfALimit = true;
    }
  }

  if (hasReadingsOnBothSidesOfALimit) {
    const advice = isSigningPage
      ? 'Write the number without a thousands separator.'
      : 'Write the number without a thousands separator, or select a format for this field.';

    errors.push(`Value ${value} could be read as ${readings.min} or ${readings.max}. ${advice}`);
  }

  if (readOnly && readings.min <= 0) {
    errors.push('A read-only field must have a value greater than 0');
  }

  return errors;
};

const readNumbers = (value: string, notations: NumberNotation[]) =>
  notations
    .filter((notation) => notation.regex.test(value))
    .map((notation) => Number(value.split(notation.groupSeparator).join('').replace(notation.decimalSeparator, '.')));

// Thousands groups have exactly three digits, after any leading zeros so that `0001,500` is read
// as grouped like `1,500`. A decimal part may come without an integer part (`.5`).
const UNFORMATTED_NOTATIONS: NumberNotation[] = [
  {
    regex: /^(?:(?:0*\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)$/,
    groupSeparator: ',',
    decimalSeparator: '.',
  },
  {
    regex: /^(?:(?:0*\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?|,\d+)$/,
    groupSeparator: '.',
    decimalSeparator: ',',
  },
];

type NumberNotation = {
  regex: RegExp;
  groupSeparator: string;
  decimalSeparator: string;
};

type NumberFieldReadings = {
  min: number;
  max: number;
};
