import { type Field, FieldType, Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { AppError } from '../errors/app-error';
import type { TCheckboxFieldMeta, TRadioFieldMeta } from '../types/field-meta';
import { extractGroupedCheckboxInsertionValues, extractGroupedRadioInsertionValues } from './envelope-signing';

const createField = (overrides: Partial<Field> & Pick<Field, 'id' | 'type'>): Field => ({
  secondaryId: `field_${overrides.id}`,
  envelopeId: 'envelope_1',
  envelopeItemId: 'item_1',
  recipientId: 1,
  page: 1,
  positionX: new Prisma.Decimal(0),
  positionY: new Prisma.Decimal(0),
  width: new Prisma.Decimal(10),
  height: new Prisma.Decimal(10),
  customText: '',
  inserted: false,
  fieldMeta: null,
  groupId: 'g',
  externalId: null,
  ...overrides,
});

const radioMeta = (values: string[]): TRadioFieldMeta => ({
  type: 'radio',
  direction: 'vertical',
  values: values.map((value, index) => ({ id: index + 1, checked: false, value })),
});

const checkboxMeta = (values: string[], overrides: Partial<TCheckboxFieldMeta> = {}): TCheckboxFieldMeta => ({
  type: 'checkbox',
  direction: 'vertical',
  values: values.map((value, index) => ({ id: index + 1, checked: false, value })),
  ...overrides,
});

describe('extractGroupedRadioInsertionValues', () => {
  const fields = [
    createField({ id: 1, type: FieldType.RADIO, fieldMeta: radioMeta(['A', 'B']) }),
    createField({ id: 2, type: FieldType.RADIO, fieldMeta: radioMeta(['C']), customText: '0', inserted: true }),
  ];

  it('selects the option on the clicked field and clears every other member', () => {
    const result = extractGroupedRadioInsertionValues({ fields, selectedFieldId: 1, selectedIndex: 1 });

    expect(result).toEqual([
      { fieldId: 1, customText: '1', inserted: true },
      { fieldId: 2, customText: '', inserted: true },
    ]);
  });

  it('uninserts the whole group when the selection is cleared', () => {
    const result = extractGroupedRadioInsertionValues({ fields, selectedFieldId: 2, selectedIndex: null });

    expect(result).toEqual([
      { fieldId: 1, customText: '', inserted: false },
      { fieldId: 2, customText: '', inserted: false },
    ]);
  });

  it('rejects an option index that does not exist on the clicked field', () => {
    expect(() => extractGroupedRadioInsertionValues({ fields, selectedFieldId: 2, selectedIndex: 3 })).toThrow(
      AppError,
    );
  });

  it('rejects a field that is not part of the group', () => {
    expect(() => extractGroupedRadioInsertionValues({ fields, selectedFieldId: 99, selectedIndex: 0 })).toThrow(
      AppError,
    );
  });
});

describe('extractGroupedCheckboxInsertionValues', () => {
  const rule = { validationRule: 'Select at least', validationLength: 2 };

  const fields = [
    createField({ id: 1, type: FieldType.CHECKBOX, fieldMeta: checkboxMeta(['A', 'B'], rule) }),
    createField({
      id: 2,
      type: FieldType.CHECKBOX,
      fieldMeta: checkboxMeta(['C'], rule),
      customText: '[0]',
      inserted: true,
    }),
  ];

  it('pools the selected count across the group when evaluating the validation rule', () => {
    // Field 1 selects one option, field 2 already has one, so the pool of 2 passes "at least 2".
    const result = extractGroupedCheckboxInsertionValues({ fields, fieldValues: [{ fieldId: 1, value: [1] }] });

    expect(result).toEqual([
      { fieldId: 1, customText: '[1]', inserted: true },
      { fieldId: 2, customText: '[0]', inserted: true },
    ]);
  });

  it('does not enforce the validation rule at sign time', () => {
    // The rule is enforced when the recipient completes the document instead.
    const result = extractGroupedCheckboxInsertionValues({
      fields,
      fieldValues: [
        { fieldId: 1, value: [1] },
        { fieldId: 2, value: [] },
      ],
    });

    expect(result).toEqual([
      { fieldId: 1, customText: '[1]', inserted: true },
      { fieldId: 2, customText: '', inserted: true },
    ]);
  });

  it('uninserts the whole group when no options remain selected', () => {
    const result = extractGroupedCheckboxInsertionValues({
      fields,
      fieldValues: [
        { fieldId: 1, value: [] },
        { fieldId: 2, value: [] },
      ],
    });

    expect(result).toEqual([
      { fieldId: 1, customText: '', inserted: false },
      { fieldId: 2, customText: '', inserted: false },
    ]);
  });

  it('marks members with no selection as inserted once the group has a selection', () => {
    const unruledFields = [
      createField({ id: 1, type: FieldType.CHECKBOX, fieldMeta: checkboxMeta(['A']) }),
      createField({ id: 2, type: FieldType.CHECKBOX, fieldMeta: checkboxMeta(['B']) }),
    ];

    const result = extractGroupedCheckboxInsertionValues({
      fields: unruledFields,
      fieldValues: [{ fieldId: 1, value: [0] }],
    });

    expect(result).toEqual([
      { fieldId: 1, customText: '[0]', inserted: true },
      { fieldId: 2, customText: '', inserted: true },
    ]);
  });

  it('rejects option indices that do not exist on their field', () => {
    expect(() => extractGroupedCheckboxInsertionValues({ fields, fieldValues: [{ fieldId: 2, value: [5] }] })).toThrow(
      AppError,
    );
  });

  it('rejects values for fields outside the group', () => {
    expect(() => extractGroupedCheckboxInsertionValues({ fields, fieldValues: [{ fieldId: 99, value: [0] }] })).toThrow(
      AppError,
    );
  });
});
