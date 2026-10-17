import { type Field, FieldType, Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { TCheckboxFieldMeta, TTextFieldMeta } from '../types/field-meta';
import { fieldsContainPendingSigningItem, getPendingSigningItems, getSigningItems } from './signing-items';

const createField = (overrides: Partial<Field> & Pick<Field, 'id' | 'type'>): Field => ({
  secondaryId: `field_${overrides.id}`,
  envelopeId: 'envelope_1',
  envelopeItemId: 'item_1',
  recipientId: 1,
  page: 1,
  positionX: new Prisma.Decimal(0),
  positionY: new Prisma.Decimal(overrides.id),
  width: new Prisma.Decimal(10),
  height: new Prisma.Decimal(10),
  customText: '',
  inserted: false,
  fieldMeta: null,
  groupId: null,
  externalId: null,
  ...overrides,
});

const textMeta = (required: boolean): TTextFieldMeta => ({ type: 'text', required });

const checkboxMeta = (values: string[], overrides: Partial<TCheckboxFieldMeta> = {}): TCheckboxFieldMeta => ({
  type: 'checkbox',
  direction: 'vertical',
  values: values.map((value, index) => ({ id: index + 1, checked: false, value })),
  ...overrides,
});

const atLeastTwo = { validationRule: 'Select at least', validationLength: 2 };

describe('getSigningItems', () => {
  it('treats each ungrouped field as its own item', () => {
    const fields = [
      createField({ id: 1, type: FieldType.TEXT, fieldMeta: textMeta(true) }),
      createField({ id: 2, type: FieldType.SIGNATURE }),
    ];

    const items = getSigningItems(fields);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.primaryField.id)).toEqual([1, 2]);
  });

  it('treats a group as a single item with the first field by document order as primary', () => {
    const fields = [
      createField({ id: 3, type: FieldType.TEXT, groupId: 'g', page: 2, fieldMeta: textMeta(true) }),
      createField({ id: 2, type: FieldType.TEXT, groupId: 'g', page: 1, fieldMeta: textMeta(true) }),
      createField({ id: 1, type: FieldType.TEXT, fieldMeta: textMeta(false) }),
    ];

    const items = getSigningItems(fields);

    expect(items).toHaveLength(2);

    const groupItem = items.find((item) => item.groupId === 'g');

    expect(groupItem?.fields.map((field) => field.id)).toEqual([2, 3]);
    expect(groupItem?.primaryField.id).toBe(2);
    expect(groupItem?.isRequired).toBe(true);
    expect(groupItem?.isInserted).toBe(false);
  });

  it('treats a group as inserted when any member is inserted', () => {
    const fields = [
      createField({ id: 1, type: FieldType.TEXT, groupId: 'g', inserted: true, customText: 'A' }),
      createField({ id: 2, type: FieldType.TEXT, groupId: 'g' }),
    ];

    expect(getSigningItems(fields)[0].isInserted).toBe(true);
  });
});

describe('getPendingSigningItems', () => {
  it('includes required items which are not inserted', () => {
    const fields = [
      createField({ id: 1, type: FieldType.TEXT, fieldMeta: textMeta(true) }),
      createField({ id: 2, type: FieldType.TEXT, fieldMeta: textMeta(false) }),
    ];

    expect(getPendingSigningItems(fields).map((item) => item.primaryField.id)).toEqual([1]);
  });

  it('counts an unanswered required group once', () => {
    const fields = [
      createField({ id: 1, type: FieldType.TEXT, groupId: 'g', fieldMeta: textMeta(true) }),
      createField({ id: 2, type: FieldType.TEXT, groupId: 'g', fieldMeta: textMeta(true) }),
      createField({ id: 3, type: FieldType.TEXT, groupId: 'g', fieldMeta: textMeta(true) }),
    ];

    expect(getPendingSigningItems(fields)).toHaveLength(1);
  });

  it('includes an inserted checkbox which fails its validation rule', () => {
    const field = createField({
      id: 1,
      type: FieldType.CHECKBOX,
      inserted: true,
      customText: '[0]',
      fieldMeta: checkboxMeta(['A', 'B', 'C'], atLeastTwo),
    });

    const [item] = getPendingSigningItems([field]);

    expect(item.validationError).toEqual({
      type: 'CHECKBOX_LENGTH',
      validationRule: '>=',
      validationLength: 2,
      selectedCount: 1,
    });
  });

  it('applies the validation rule to an inserted optional checkbox', () => {
    const field = createField({
      id: 1,
      type: FieldType.CHECKBOX,
      inserted: true,
      customText: '[0]',
      fieldMeta: checkboxMeta(['A', 'B'], { ...atLeastTwo, required: false }),
    });

    expect(getPendingSigningItems([field])).toHaveLength(1);
  });

  it('does not flag an optional checkbox which has not been inserted', () => {
    const field = createField({
      id: 1,
      type: FieldType.CHECKBOX,
      fieldMeta: checkboxMeta(['A', 'B'], { ...atLeastTwo, required: false }),
    });

    expect(getPendingSigningItems([field])).toHaveLength(0);
  });

  it('pools checkbox selections across a group when evaluating the rule', () => {
    const fields = [
      createField({
        id: 1,
        type: FieldType.CHECKBOX,
        groupId: 'g',
        inserted: true,
        customText: '[0]',
        fieldMeta: checkboxMeta(['A'], atLeastTwo),
      }),
      createField({
        id: 2,
        type: FieldType.CHECKBOX,
        groupId: 'g',
        inserted: true,
        customText: '[0]',
        fieldMeta: checkboxMeta(['B'], atLeastTwo),
      }),
    ];

    expect(getPendingSigningItems(fields)).toHaveLength(0);

    // Unticking one member drops the pool below the rule.
    fields[1].customText = '';

    const [item] = getPendingSigningItems(fields);

    expect(item.validationError?.selectedCount).toBe(1);
  });

  it('passes a checkbox which satisfies its rule', () => {
    const field = createField({
      id: 1,
      type: FieldType.CHECKBOX,
      inserted: true,
      customText: '[0,1]',
      fieldMeta: checkboxMeta(['A', 'B'], atLeastTwo),
    });

    expect(getPendingSigningItems([field])).toHaveLength(0);
  });
});

describe('fieldsContainPendingSigningItem', () => {
  it('returns false when every item is complete and valid', () => {
    const fields = [
      createField({ id: 1, type: FieldType.TEXT, inserted: true, customText: 'A', fieldMeta: textMeta(true) }),
      createField({ id: 2, type: FieldType.TEXT, fieldMeta: textMeta(false) }),
    ];

    expect(fieldsContainPendingSigningItem(fields)).toBe(false);
  });

  it('returns true when a required item is missing', () => {
    expect(fieldsContainPendingSigningItem([createField({ id: 1, type: FieldType.SIGNATURE })])).toBe(true);
  });
});
