import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { AppError, AppErrorCode } from '../../errors/app-error';
import {
  parseFieldMetaFromPlaceholder,
  parseFieldTypeFromPlaceholder,
  parsePlaceholderData,
  parseRawFieldMetaFromPlaceholder,
} from './helpers';

const expectInvalidBody = (fn: () => unknown) => {
  try {
    fn();
    expect.unreachable('Expected an AppError to be thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(AppErrorCode.INVALID_BODY);
  }
};

describe('parseFieldTypeFromPlaceholder function', () => {
  it('maps known field type strings to the FieldType enum', () => {
    expect(parseFieldTypeFromPlaceholder('signature')).toBe(FieldType.SIGNATURE);
    expect(parseFieldTypeFromPlaceholder('radio')).toBe(FieldType.RADIO);
    expect(parseFieldTypeFromPlaceholder('checkbox')).toBe(FieldType.CHECKBOX);
    expect(parseFieldTypeFromPlaceholder('dropdown')).toBe(FieldType.DROPDOWN);
  });

  it('is case-insensitive and trims surrounding whitespace', () => {
    expect(parseFieldTypeFromPlaceholder('  SiGnAtUrE  ')).toBe(FieldType.SIGNATURE);
    expect(parseFieldTypeFromPlaceholder('RADIO')).toBe(FieldType.RADIO);
  });

  it('throws INVALID_BODY for an unknown field type', () => {
    expectInvalidBody(() => parseFieldTypeFromPlaceholder('FILE'));
  });
});

describe('parsePlaceholderData function', () => {
  it('splits top-level parts on commas and trims each token', () => {
    expect(parsePlaceholderData('SIGNATURE, r1, required=true')).toEqual(['SIGNATURE', 'r1', 'required=true']);
  });

  it('does not split on escaped commas', () => {
    expect(parsePlaceholderData('dropdown, r1, options=Legal\\, Compliance|Sales')).toEqual([
      'dropdown',
      'r1',
      'options=Legal\\, Compliance|Sales',
    ]);
  });
});

describe('parseRawFieldMetaFromPlaceholder function', () => {
  it('splits each token into a key/value entry', () => {
    expect(parseRawFieldMetaFromPlaceholder(['required=true', 'fontSize=12'])).toEqual({
      required: 'true',
      fontSize: '12',
    });
  });

  it('only splits on the first unescaped equals sign', () => {
    expect(parseRawFieldMetaFromPlaceholder(['label=a=b'])).toEqual({ label: 'a=b' });
  });

  it('drops tokens without a value and overwrites duplicate keys with the last', () => {
    expect(parseRawFieldMetaFromPlaceholder(['required', 'fontSize=12', 'fontSize=14'])).toEqual({
      fontSize: '14',
    });
  });
});

describe('parseFieldMetaFromPlaceholder function', () => {
  describe('non-field-meta cases', () => {
    it('returns undefined for signature and free signature fields', () => {
      expect(parseFieldMetaFromPlaceholder({ required: 'true' }, FieldType.SIGNATURE)).toBeUndefined();
      expect(parseFieldMetaFromPlaceholder({}, FieldType.FREE_SIGNATURE)).toBeUndefined();
    });

    it('returns undefined when there is no metadata', () => {
      expect(parseFieldMetaFromPlaceholder({}, FieldType.TEXT)).toBeUndefined();
    });
  });

  describe('generic metadata', () => {
    it('coerces required/readOnly to booleans (case-insensitive)', () => {
      expect(parseFieldMetaFromPlaceholder({ required: 'TRUE', readOnly: 'false' }, FieldType.TEXT)).toEqual({
        type: 'text',
        required: true,
        readOnly: false,
      });
    });

    it('coerces numeric properties to numbers', () => {
      expect(parseFieldMetaFromPlaceholder({ fontSize: '14' }, FieldType.TEXT)).toEqual({
        type: 'text',
        fontSize: 14,
      });
    });

    it('drops numeric properties that are not a number', () => {
      const parsed = parseFieldMetaFromPlaceholder({ fontSize: 'abc' }, FieldType.TEXT);

      expect(parsed).toEqual({ type: 'text' });
      expect(parsed).not.toHaveProperty('fontSize');
    });

    it('keeps label/placeholder for non-selection fields', () => {
      expect(parseFieldMetaFromPlaceholder({ label: 'Company Name', placeholder: 'Acme' }, FieldType.TEXT)).toEqual({
        type: 'text',
        label: 'Company Name',
        placeholder: 'Acme',
      });
    });
  });

  describe('radio fields', () => {
    it('builds stable values from options', () => {
      expect(parseFieldMetaFromPlaceholder({ options: 'Yes|No|Maybe' }, FieldType.RADIO)).toEqual({
        type: 'radio',
        values: [
          { id: 1, checked: false, value: 'Yes' },
          { id: 2, checked: false, value: 'No' },
          { id: 3, checked: false, value: 'Maybe' },
        ],
      });
    });

    it('marks only the selected option as checked', () => {
      const parsed = parseFieldMetaFromPlaceholder({ options: 'Yes|No|Maybe', selected: 'No' }, FieldType.RADIO);

      expect(parsed).toEqual({
        type: 'radio',
        values: [
          { id: 1, checked: false, value: 'Yes' },
          { id: 2, checked: true, value: 'No' },
          { id: 3, checked: false, value: 'Maybe' },
        ],
      });
    });

    it('throws when a default value is provided without options', () => {
      expectInvalidBody(() => parseFieldMetaFromPlaceholder({ selected: 'No' }, FieldType.RADIO));
    });

    it('throws when the default value does not match an option', () => {
      expectInvalidBody(() => parseFieldMetaFromPlaceholder({ options: 'Yes|No', selected: 'Maybe' }, FieldType.RADIO));
    });

    it('throws when options is empty', () => {
      expectInvalidBody(() => parseFieldMetaFromPlaceholder({ options: '' }, FieldType.RADIO));
    });
  });

  describe('checkbox fields', () => {
    it('builds values with checked state, validation rule alias and length', () => {
      const parsed = parseFieldMetaFromPlaceholder(
        {
          options: 'Email|SMS|Phone',
          checked: 'Email|Phone',
          validationRule: 'atLeast',
          validationLength: '1',
        },
        FieldType.CHECKBOX,
      );

      expect(parsed).toEqual({
        type: 'checkbox',
        validationRule: 'Select at least',
        validationLength: 1,
        values: [
          { id: 1, checked: true, value: 'Email' },
          { id: 2, checked: false, value: 'SMS' },
          { id: 3, checked: true, value: 'Phone' },
        ],
      });
    });

    it('throws for an unknown validation rule', () => {
      expectInvalidBody(() =>
        parseFieldMetaFromPlaceholder({ options: 'A|B', validationRule: 'nope' }, FieldType.CHECKBOX),
      );
    });

    it('throws when checked values are provided without options', () => {
      expectInvalidBody(() => parseFieldMetaFromPlaceholder({ checked: 'A' }, FieldType.CHECKBOX));
    });

    it('throws when a checked value does not match an option', () => {
      expectInvalidBody(() => parseFieldMetaFromPlaceholder({ options: 'A|B', checked: 'C' }, FieldType.CHECKBOX));
    });
  });

  describe('dropdown fields', () => {
    it('builds values and sets a matching default value', () => {
      expect(
        parseFieldMetaFromPlaceholder(
          { options: 'United States|Canada|United Kingdom', defaultValue: 'Canada' },
          FieldType.DROPDOWN,
        ),
      ).toEqual({
        type: 'dropdown',
        values: [{ value: 'United States' }, { value: 'Canada' }, { value: 'United Kingdom' }],
        defaultValue: 'Canada',
      });
    });

    it('throws when the default value does not match an option', () => {
      expectInvalidBody(() => parseFieldMetaFromPlaceholder({ options: 'A|B', defaultValue: 'C' }, FieldType.DROPDOWN));
    });
  });

  describe('selection field options parsing', () => {
    it('trims option values and drops empty entries', () => {
      expect(parseFieldMetaFromPlaceholder({ options: ' A ||  B  ' }, FieldType.DROPDOWN)).toEqual({
        type: 'dropdown',
        values: [{ value: 'A' }, { value: 'B' }],
      });
    });

    it('parses escaped delimiters through the full placeholder pipeline', () => {
      const [, , ...fieldMetaData] = parsePlaceholderData(
        'dropdown, r1, options=Sales\\|Ops|Legal\\, Compliance|A\\=B',
      );

      const rawFieldMeta = parseRawFieldMetaFromPlaceholder(fieldMetaData);
      const parsed = parseFieldMetaFromPlaceholder(rawFieldMeta, FieldType.DROPDOWN);

      expect(parsed).toEqual({
        type: 'dropdown',
        values: [{ value: 'Sales|Ops' }, { value: 'Legal, Compliance' }, { value: 'A=B' }],
      });
    });
  });
});
