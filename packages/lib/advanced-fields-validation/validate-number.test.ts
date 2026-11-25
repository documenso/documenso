import { describe, expect, it } from 'vitest';

import type { TNumberFieldMeta } from '../types/field-meta';
import { validateNumberField } from './validate-number';

const COMMA_GROUPS = '123,456,789.00';
const DOT_GROUPS = '123.456.789,00';
const SINGLE_COMMA_GROUP = '123456,789.00';

type Limits = Pick<TNumberFieldMeta, 'minValue' | 'maxValue'>;

const meta = (overrides: Partial<TNumberFieldMeta> = {}): TNumberFieldMeta => ({
  type: 'number',
  required: true,
  ...overrides,
});

describe('validateNumberField', () => {
  it.each([
    '...',
    ',',
    '.',
    '1.2.3',
    '1,2,3',
    '1..2',
    '10,00,000',
    '1.000.50',
    '1,000.5,3',
    ',.',
    '',
  ])('rejects %j as not a number, whatever the limits', (value) => {
    expect(validateNumberField(value, meta(), true)).toContain('Value is not a valid number');

    expect(validateNumberField(value, meta({ minValue: 1, maxValue: 100 }), true)).toContain(
      'Value is not a valid number',
    );
  });

  // Limits equal to the expected number pin down the number each value is compared as. Read
  // only, since a read only value only has to be above 0 and '.5' is one.
  it.each<[string, number]>([
    ['50', 50],
    ['007', 7],
    [' 42 ', 42],
    ['.5', 0.5],
    ['5.', 5],
    [',5', 0.5],
    ['5,', 5],
    ['12.50', 12.5],
    ['12,50', 12.5],
    ['1,5', 1.5],
    ['1,00', 1],
    ['1000,5', 1000.5],
    ['1,000.50', 1000.5],
    ['1.000,50', 1000.5],
    ['1,000,000', 1000000],
    ['1.000.000', 1000000],
  ])('without a format, reads %j as %d', (value, expected) => {
    const errors = validateNumberField(
      value,
      meta({ required: false, readOnly: true, minValue: expected, maxValue: expected }),
      true,
    );

    expect(errors).toEqual([]);
  });

  it.each<[string, Limits]>([
    ['1,500', {}],
    ['1.500', { minValue: 1, maxValue: 2000 }],
  ])('accepts %j with limits %j, since both readings are within them', (value, limits) => {
    expect(validateNumberField(value, meta(limits), true)).toEqual([]);
  });

  it.each<[string, Limits]>([
    ['1.500', { maxValue: 100 }],
    ['1,500', { minValue: 100 }],
    ['999.999', { maxValue: 1000 }],
    ['1,500.', { minValue: 100 }],
    ['1.500,', { minValue: 100 }],
    ['0001,500', { maxValue: 100 }],
  ])('rejects %j with limits %j as ambiguous, since only one reading is within them', (value, limits) => {
    const errors = validateNumberField(value, meta(limits), true);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('could be read as');
  });

  it('rejects a value with both readings outside a limit as out of range, not as ambiguous', () => {
    expect(validateNumberField('1.500', meta({ maxValue: 1 }), true)).toEqual([
      'Value 1.500 is greater than the maximum value of 1',
    ]);
  });

  it.each<[string, string, Limits]>([
    ['1,000.5', COMMA_GROUPS, { minValue: 1000.5, maxValue: 1000.5 }],
    ['1.000,5', DOT_GROUPS, { minValue: 1000.5, maxValue: 1000.5 }],
    ['1,000.5', SINGLE_COMMA_GROUP, { minValue: 1000.5, maxValue: 1000.5 }],
    ['1,500', COMMA_GROUPS, { minValue: 1000 }],
    ['1.500', DOT_GROUPS, { minValue: 1000 }],
  ])('accepts %j in the format %s with limits %j', (value, numberFormat, limits) => {
    expect(validateNumberField(value, meta({ numberFormat, ...limits }), true)).toEqual([]);
  });

  it.each<[string, string, Limits]>([
    ['1,5', COMMA_GROUPS, {}],
    ['1.5', DOT_GROUPS, {}],
    ['1.555', COMMA_GROUPS, {}],
    [' 42 ', COMMA_GROUPS, {}],
    ['1,5', SINGLE_COMMA_GROUP, { minValue: 1, maxValue: 1000 }],
    ['1,50', SINGLE_COMMA_GROUP, { minValue: 1, maxValue: 1000 }],
    ['1,5.3', SINGLE_COMMA_GROUP, { minValue: 1, maxValue: 1000 }],
  ])('rejects %j in the format %s with limits %j', (value, numberFormat, limits) => {
    expect(validateNumberField(value, meta({ numberFormat, ...limits }), true)).toContain(
      `Value ${value} does not match the number format - ${numberFormat}`,
    );
  });
});
