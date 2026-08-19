import { describe, expect, it } from 'vitest';

import type { TNumberFieldMeta as NumberFieldMeta } from '../types/field-meta';
import { parseNumberFieldValue, validateNumberField } from './validate-number';

const meta = (overrides: Partial<NumberFieldMeta>): NumberFieldMeta =>
  ({ type: 'number', ...overrides }) as NumberFieldMeta;

describe('parseNumberFieldValue', () => {
  it('parses a plain decimal', () => {
    expect(parseNumberFieldValue('1234.56')).toBe(1234.56);
  });

  it('parses a comma-grouped value', () => {
    expect(parseNumberFieldValue('1,234.56', '123,456,789.00')).toBe(1234.56);
    expect(parseNumberFieldValue('1,000')).toBe(1000);
  });

  it('parses a dot-grouped value with a comma decimal', () => {
    expect(parseNumberFieldValue('1.234,56', '123.456.789,00')).toBe(1234.56);
  });
});

describe('validateNumberField', () => {
  it('accepts a grouped value within the range', () => {
    expect(
      validateNumberField(
        '1,234.56',
        meta({ minValue: 1000, maxValue: 2000, numberFormat: '123,456,789.00' }),
      ),
    ).toEqual([]);
  });

  it('rejects a grouped value above the maximum', () => {
    // Regression: parseFloat('1,234.56') is 1, so this compared 1 against the
    // maximum and let a value well over it through.
    const errors = validateNumberField(
      '1,234.56',
      meta({ maxValue: 100, numberFormat: '123,456,789.00' }),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('greater than the maximum value');
  });

  it('does not report a grouped value as below the minimum', () => {
    // Regression: parseFloat('1,234.56') is 1, so a value comfortably above the
    // minimum was rejected.
    expect(
      validateNumberField('1,234.56', meta({ minValue: 500, numberFormat: '123,456,789.00' })),
    ).toEqual([]);
  });

  it('applies the range to a dot-grouped value', () => {
    expect(
      validateNumberField('1.234,56', meta({ minValue: 1000, numberFormat: '123.456.789,00' })),
    ).toEqual([]);

    const errors = validateNumberField(
      '1.234,56',
      meta({ maxValue: 100, numberFormat: '123.456.789,00' }),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('greater than the maximum value');
  });

  it('still enforces the range on ungrouped values', () => {
    expect(validateNumberField('5', meta({ minValue: 10 }))[0]).toContain(
      'less than the minimum value',
    );
    expect(validateNumberField('50', meta({ maxValue: 10 }))[0]).toContain(
      'greater than the maximum value',
    );
    expect(validateNumberField('15', meta({ minValue: 10, maxValue: 20 }))).toEqual([]);
  });
});
