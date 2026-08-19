import { describe, expect, it } from 'vitest';

import type { TNumberFieldMeta } from '../types/field-meta';
import { validateNumberField } from './validate-number';

const READ_ONLY_ERROR = 'A read-only field must have a value greater than 0';

const meta = (overrides: Partial<TNumberFieldMeta>): TNumberFieldMeta =>
  ({ type: 'number', ...overrides }) as TNumberFieldMeta;

describe('validateNumberField', () => {
  describe('read-only fields', () => {
    it('accepts a positive value below 1 (it is still greater than 0)', () => {
      expect(validateNumberField('0.5', meta({ readOnly: true }))).not.toContain(READ_ONLY_ERROR);
    });

    it('rejects zero', () => {
      expect(validateNumberField('0', meta({ readOnly: true }))).toContain(READ_ONLY_ERROR);
    });
  });

  describe('min/max bounds', () => {
    it('reports a single error when the minimum exceeds the maximum', () => {
      const errors = validateNumberField('5', meta({ minValue: 10, maxValue: 5 }));

      const minMaxErrors = errors.filter(
        (error) =>
          error === 'Minimum value cannot be greater than maximum value' ||
          error === 'Maximum value cannot be less than minimum value',
      );

      expect(minMaxErrors).toEqual(['Minimum value cannot be greater than maximum value']);
    });
  });
});
