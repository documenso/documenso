import { FieldType } from '@prisma/client';
import { assert, describe, expect, it } from 'vitest';

import type { TCheckboxFieldMeta, TRadioFieldMeta } from '../types/field-meta';
import { applyEditorFieldUpdate, resolveEditorFieldGroupChanges } from './editor-field-group-changes';
import type { TLocalField } from './hooks/use-editor-fields';

const createLocalField = (overrides: Partial<TLocalField> & Pick<TLocalField, 'formId' | 'type'>): TLocalField => ({
  envelopeItemId: 'item_1',
  recipientId: 1,
  page: 1,
  positionX: 10,
  positionY: 10,
  width: 10,
  height: 10,
  fieldMeta: undefined,
  groupId: null,
  externalId: null,
  ...overrides,
});

const checkboxMeta = (values: string[], overrides: Partial<TCheckboxFieldMeta> = {}): TCheckboxFieldMeta => ({
  type: 'checkbox',
  direction: 'vertical',
  values: values.map((value, index) => ({ id: index + 1, checked: false, value })),
  ...overrides,
});

const radioMeta = (checked: boolean): TRadioFieldMeta => ({
  type: 'radio',
  direction: 'vertical',
  values: [{ id: 1, checked, value: 'Option' }],
});

const atLeastTwo = { validationRule: 'Select at least', validationLength: 2 };

describe('applyEditorFieldUpdate', () => {
  const field = createLocalField({ formId: 'a', type: FieldType.TEXT, groupId: 'g' });

  it('keeps the group when the type and recipient are unchanged', () => {
    expect(applyEditorFieldUpdate(field, { positionX: 20 }).groupId).toBe('g');
  });

  it('leaves the group when the type changes', () => {
    expect(applyEditorFieldUpdate(field, { type: FieldType.NUMBER }).groupId).toBeNull();
  });

  it('leaves the group when the recipient changes', () => {
    expect(applyEditorFieldUpdate(field, { recipientId: 2 }).groupId).toBeNull();
  });
});

describe('resolveEditorFieldGroupChanges', () => {
  const groupedCheckbox = (formId: string, value: string, overrides: Partial<TCheckboxFieldMeta> = {}) =>
    createLocalField({
      formId,
      type: FieldType.CHECKBOX,
      groupId: 'g',
      fieldMeta: checkboxMeta([value], { ...atLeastTwo, ...overrides }),
    });

  it('makes a joining field adopt the meta of an existing field', () => {
    const existing = groupedCheckbox('a', 'A', { required: true });
    const joiner = createLocalField({ formId: 'b', type: FieldType.CHECKBOX, fieldMeta: checkboxMeta(['B']) });

    const { reconciledFields } = resolveEditorFieldGroupChanges({
      previousFields: [existing, joiner],
      nextFields: [existing, { ...joiner, groupId: 'g' }],
      changedFormIds: new Set(['b']),
    });

    const reconciledJoiner = reconciledFields.find((field) => field.formId === 'b');

    assert(reconciledJoiner?.fieldMeta?.type === 'checkbox');
    expect(reconciledJoiner.fieldMeta.required).toBe(true);
    expect(reconciledJoiner.fieldMeta.validationLength).toBe(2);
    // Per field options are preserved.
    expect(reconciledJoiner.fieldMeta.values?.[0].value).toBe('B');

    // The existing field is untouched.
    expect(reconciledFields.find((field) => field.formId === 'a')).toBe(existing);
  });

  it('removes the validation rule from the remaining fields when a field is removed', () => {
    const previousFields = [groupedCheckbox('a', 'A'), groupedCheckbox('b', 'B')];

    const { reconciledFields, validationRemovedGroupIds } = resolveEditorFieldGroupChanges({
      previousFields,
      nextFields: [previousFields[0]],
      changedFormIds: new Set(),
    });

    expect(validationRemovedGroupIds).toEqual(['g']);

    const reconciledA = reconciledFields[0];

    assert(reconciledA.fieldMeta?.type === 'checkbox');
    expect(reconciledA.fieldMeta.validationRule).toBeUndefined();
  });

  it('removes the validation rule from the old group when a field leaves it', () => {
    const previousFields = [groupedCheckbox('a', 'A'), groupedCheckbox('b', 'B')];

    const { reconciledFields, validationRemovedGroupIds } = resolveEditorFieldGroupChanges({
      previousFields,
      nextFields: [previousFields[0], { ...previousFields[1], groupId: null }],
      changedFormIds: new Set(['b']),
    });

    expect(validationRemovedGroupIds).toEqual(['g']);

    const reconciledA = reconciledFields.find((field) => field.formId === 'a');

    assert(reconciledA?.fieldMeta?.type === 'checkbox');
    expect(reconciledA.fieldMeta.validationRule).toBeUndefined();
  });

  it('unchecks a duplicated radio when the group already has a selection', () => {
    const original = createLocalField({ formId: 'a', type: FieldType.RADIO, groupId: 'g', fieldMeta: radioMeta(true) });
    const clone = { ...original, formId: 'b' };

    const { reconciledFields } = resolveEditorFieldGroupChanges({
      previousFields: [original],
      nextFields: [original, clone],
      changedFormIds: new Set(['b']),
    });

    const reconciledClone = reconciledFields.find((field) => field.formId === 'b');

    assert(reconciledClone?.fieldMeta?.type === 'radio');
    expect(reconciledClone.fieldMeta.values?.[0].checked).toBe(false);

    expect(reconciledFields.find((field) => field.formId === 'a')).toBe(original);
  });
});
