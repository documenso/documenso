import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

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

  it('respects an explicit group id alongside a type change', () => {
    expect(applyEditorFieldUpdate(field, { type: FieldType.NUMBER, groupId: 'h' }).groupId).toBe('h');
  });

  it('clamps positions to the page', () => {
    const updated = applyEditorFieldUpdate(field, { positionX: 150, positionY: -5 });

    expect(updated.positionX).toBe(100);
    expect(updated.positionY).toBe(0);
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

  it('syncs shared meta from the edited member to its siblings', () => {
    const previousFields = [groupedCheckbox('a', 'A'), groupedCheckbox('b', 'B')];
    const editedA = { ...previousFields[0], fieldMeta: checkboxMeta(['A'], { ...atLeastTwo, required: true }) };

    const { reconciledFields, validationRemovedGroupIds } = resolveEditorFieldGroupChanges({
      previousFields,
      nextFields: [editedA, previousFields[1]],
      changedFormIds: new Set(['a']),
    });

    const reconciledB = reconciledFields.find((field) => field.formId === 'b');

    expect(reconciledB?.fieldMeta?.required).toBe(true);
    expect(validationRemovedGroupIds).toEqual([]);
  });

  it('makes a joining field adopt the meta of an existing member', () => {
    const existing = groupedCheckbox('a', 'A', { required: true });
    const joiner = createLocalField({ formId: 'b', type: FieldType.CHECKBOX, fieldMeta: checkboxMeta(['B']) });

    const { reconciledFields } = resolveEditorFieldGroupChanges({
      previousFields: [existing, joiner],
      nextFields: [existing, { ...joiner, groupId: 'g' }],
      changedFormIds: new Set(['b']),
    });

    const reconciledJoiner = reconciledFields.find((field) => field.formId === 'b');

    expect(reconciledJoiner?.fieldMeta?.required).toBe(true);

    if (reconciledJoiner?.fieldMeta?.type === 'checkbox') {
      expect(reconciledJoiner.fieldMeta.validationLength).toBe(2);
      // Per field options are preserved.
      expect(reconciledJoiner.fieldMeta.values?.[0].value).toBe('B');
    }

    // The existing member is untouched.
    expect(reconciledFields.find((field) => field.formId === 'a')).toBe(existing);
  });

  it('removes the validation rule from the remaining members when a field is removed', () => {
    const previousFields = [groupedCheckbox('a', 'A'), groupedCheckbox('b', 'B')];

    const { reconciledFields, validationRemovedGroupIds } = resolveEditorFieldGroupChanges({
      previousFields,
      nextFields: [previousFields[0]],
      changedFormIds: new Set(),
    });

    expect(validationRemovedGroupIds).toEqual(['g']);

    const reconciledA = reconciledFields[0];

    if (reconciledA.fieldMeta?.type === 'checkbox') {
      expect(reconciledA.fieldMeta.validationRule).toBeUndefined();
    }
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

    if (reconciledA?.fieldMeta?.type === 'checkbox') {
      expect(reconciledA.fieldMeta.validationRule).toBeUndefined();
    }
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

    if (reconciledClone?.fieldMeta?.type === 'radio') {
      expect(reconciledClone.fieldMeta.values?.[0].checked).toBe(false);
    }

    expect(reconciledFields.find((field) => field.formId === 'a')).toBe(original);
  });

  it('lets an edited radio selection win over a sibling', () => {
    const a = createLocalField({ formId: 'a', type: FieldType.RADIO, groupId: 'g', fieldMeta: radioMeta(true) });
    const b = createLocalField({ formId: 'b', type: FieldType.RADIO, groupId: 'g', fieldMeta: radioMeta(false) });

    const { reconciledFields } = resolveEditorFieldGroupChanges({
      previousFields: [a, b],
      nextFields: [a, { ...b, fieldMeta: radioMeta(true) }],
      changedFormIds: new Set(['b']),
    });

    const reconciledA = reconciledFields.find((field) => field.formId === 'a');

    if (reconciledA?.fieldMeta?.type === 'radio') {
      expect(reconciledA.fieldMeta.values?.[0].checked).toBe(false);
    }
  });

  it('ignores changes to fields which are not grouped', () => {
    const field = createLocalField({ formId: 'a', type: FieldType.TEXT });

    const result = resolveEditorFieldGroupChanges({
      previousFields: [field],
      nextFields: [{ ...field, positionX: 50 }],
      changedFormIds: new Set(['a']),
    });

    expect(result.validationRemovedGroupIds).toEqual([]);
    expect(result.reconciledFields[0].positionX).toBe(50);
  });
});
