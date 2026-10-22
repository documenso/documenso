import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { ZEnvelopeFieldAndMetaSchema } from '../../types/field-meta';
import {
  parseOptionFieldMetaFromPlaceholder,
  parsePlaceholderOptionList,
  splitPlaceholderProperties,
} from './placeholder-options';

describe('splitPlaceholderProperties', () => {
  it('splits on commas and trims each property', () => {
    expect(splitPlaceholderProperties('checkbox , r1, required=true')).toEqual(['checkbox', 'r1', 'required=true']);
  });

  it('keeps commas inside a quoted list', () => {
    expect(splitPlaceholderProperties('checkbox, r1, values="A, detailed|B", required=true')).toEqual([
      'checkbox',
      'r1',
      'values="A, detailed|B"',
      'required=true',
    ]);
  });
});

describe('parsePlaceholderOptionList', () => {
  it('splits on pipes and trims options', () => {
    expect(parsePlaceholderOptionList('Option A | Option B|Option C')).toEqual(['Option A', 'Option B', 'Option C']);
  });

  it('strips quotes around the whole list', () => {
    expect(parsePlaceholderOptionList('"A, detailed|B"')).toEqual(['A, detailed', 'B']);
  });

  it('treats \\| as a literal pipe', () => {
    expect(parsePlaceholderOptionList('Either\\|Or|Neither')).toEqual(['Either|Or', 'Neither']);
  });

  it('decodes \\% to %', () => {
    expect(parsePlaceholderOptionList('100\\%|200\\%')).toEqual(['100%', '200%']);
  });

  it('keeps other backslashes', () => {
    expect(parsePlaceholderOptionList('C:\\temp|D')).toEqual(['C:\\temp', 'D']);
  });

  it.each([
    ['', 'at least one option'],
    ['""', 'at least one option'],
    ['A||B', 'empty option'],
    ['A|', 'empty option'],
    ['"A|B', 'unclosed quote'],
    ['"A"|"B"', 'Quote the whole option list'],
    ['A|"B"', 'Quote the whole option list'],
  ])('rejects %j', (list, message) => {
    expect(() => parsePlaceholderOptionList(list)).toThrow(message);
  });
});

describe('parseOptionFieldMetaFromPlaceholder', () => {
  it('builds checkbox values with ids and multiple defaults', () => {
    expect(parseOptionFieldMetaFromPlaceholder({ values: 'A|B|C', default: 'A|C' }, FieldType.CHECKBOX)).toEqual({
      values: [
        { id: 1, checked: true, value: 'A' },
        { id: 2, checked: false, value: 'B' },
        { id: 3, checked: true, value: 'C' },
      ],
    });
  });

  it('builds radio values with a single default', () => {
    expect(parseOptionFieldMetaFromPlaceholder({ values: 'Yes|No', default: 'No' }, FieldType.RADIO)).toEqual({
      values: [
        { id: 1, checked: false, value: 'Yes' },
        { id: 2, checked: true, value: 'No' },
      ],
    });
  });

  it('builds dropdown values and defaultValue from options=', () => {
    expect(parseOptionFieldMetaFromPlaceholder({ options: 'Red|Green', default: 'Green' }, FieldType.DROPDOWN)).toEqual(
      {
        values: [{ value: 'Red' }, { value: 'Green' }],
        defaultValue: 'Green',
      },
    );
  });

  it('returns nothing when no option list is given', () => {
    expect(parseOptionFieldMetaFromPlaceholder({ label: 'Confirm' }, FieldType.RADIO)).toEqual({});
  });

  it.each([
    [{ values: 'A|B|A' }, FieldType.CHECKBOX, 'Option "A" is listed more than once'],
    [{ values: 'A', options: 'B' }, FieldType.DROPDOWN, 'either values= or options='],
    [{ default: 'A' }, FieldType.RADIO, 'default= requires values='],
    [{ values: 'A|B', default: 'C' }, FieldType.CHECKBOX, 'Default "C" is not one of the options'],
    [{ values: 'A|B', default: 'A|B' }, FieldType.RADIO, 'radio fields accept a single default'],
    [{ values: 'A|B', default: 'A|B' }, FieldType.DROPDOWN, 'dropdown fields accept a single default'],
  ] as const)('rejects %j for %s', (rawFieldMeta, fieldType, message) => {
    expect(() => parseOptionFieldMetaFromPlaceholder(rawFieldMeta, fieldType)).toThrow(message);
  });

  it.each([
    [FieldType.CHECKBOX, 'checkbox'],
    [FieldType.RADIO, 'radio'],
    [FieldType.DROPDOWN, 'dropdown'],
  ] as const)('produces %s meta that passes the field schema', (fieldType, metaType) => {
    const optionMeta = parseOptionFieldMetaFromPlaceholder({ values: 'A|B', default: 'B' }, fieldType);

    const parsed = ZEnvelopeFieldAndMetaSchema.parse({
      type: fieldType,
      fieldMeta: { type: metaType, ...optionMeta },
    });

    expect(parsed.fieldMeta).toMatchObject(optionMeta);
  });
});
