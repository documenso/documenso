import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { validateFieldMetaConfiguration } from './validate-field-meta-configuration';

describe('validateFieldMetaConfiguration', () => {
  it('rejects a field that is both required and read-only', () => {
    const errors = validateFieldMetaConfiguration(FieldType.TEXT, {
      required: true,
      readOnly: true,
      text: 'pre-filled',
    });

    expect(errors).toContain('A field cannot be both read-only and required');
  });

  it('rejects the combination for every documented field type', () => {
    for (const type of [FieldType.TEXT, FieldType.NUMBER, FieldType.RADIO, FieldType.CHECKBOX, FieldType.DROPDOWN]) {
      expect(
        validateFieldMetaConfiguration(type, { required: true, readOnly: true }),
      ).toContain('A field cannot be both read-only and required');
    }
  });

  it('accepts required-only and read-only-with-default configurations', () => {
    expect(validateFieldMetaConfiguration(FieldType.TEXT, { required: true })).toEqual([]);
    expect(validateFieldMetaConfiguration(FieldType.TEXT, { readOnly: true, text: 'pre-filled' })).toEqual([]);
    expect(validateFieldMetaConfiguration(FieldType.SIGNATURE, { required: true })).toEqual([]);
    expect(validateFieldMetaConfiguration(FieldType.TEXT, undefined)).toEqual([]);
  });

  it('rejects a read-only text field without a default value', () => {
    const errors = validateFieldMetaConfiguration(FieldType.TEXT, { readOnly: true });

    expect(errors).toEqual(['A read-only field must have text']);
  });

  it('rejects a read-only number field without a usable default value', () => {
    expect(validateFieldMetaConfiguration(FieldType.NUMBER, { readOnly: true })).toEqual([
      'A read-only field must have a value greater than 0',
    ]);
    expect(validateFieldMetaConfiguration(FieldType.NUMBER, { readOnly: true, value: '0' })).toEqual([
      'A read-only field must have a value greater than 0',
    ]);
    expect(validateFieldMetaConfiguration(FieldType.NUMBER, { readOnly: true, value: '42' })).toEqual([]);
  });

  it('rejects read-only choice fields with no option values', () => {
    const expected = ['A read-only field must have at least one value'];

    expect(validateFieldMetaConfiguration(FieldType.RADIO, { readOnly: true })).toEqual(expected);
    expect(
      validateFieldMetaConfiguration(FieldType.CHECKBOX, { readOnly: true, values: [] }),
    ).toEqual(expected);
    expect(validateFieldMetaConfiguration(FieldType.DROPDOWN, { readOnly: true, values: [] })).toEqual(expected);
    expect(
      validateFieldMetaConfiguration(FieldType.DROPDOWN, { readOnly: true, values: [{ value: 'a' }] }),
    ).toEqual([]);
  });

  it('reports both violations together when a field breaks both rules', () => {
    const errors = validateFieldMetaConfiguration(FieldType.TEXT, { required: true, readOnly: true });

    expect(errors).toEqual([
      'A field cannot be both read-only and required',
      'A read-only field must have text',
    ]);
  });
});
