import { FieldType } from '@prisma/client';
import { assert, describe, expect, it } from 'vitest';

import type { TCheckboxFieldMeta, TRadioFieldMeta, TTextFieldMeta } from '../types/field-meta';
import {
  reconcileFieldGroup,
  reconcileFieldGroupsAfterRemoval,
  removeFieldGroupValidation,
} from './field-group-reconciliation';

const checkboxMeta = (overrides: Partial<TCheckboxFieldMeta> = {}): TCheckboxFieldMeta => ({
  type: 'checkbox',
  values: [{ id: 1, checked: false, value: 'A' }],
  direction: 'vertical',
  required: false,
  readOnly: false,
  ...overrides,
});

const radioMeta = (overrides: Partial<TRadioFieldMeta> = {}): TRadioFieldMeta => ({
  type: 'radio',
  values: [{ id: 1, checked: false, value: 'A' }],
  direction: 'vertical',
  required: false,
  readOnly: false,
  ...overrides,
});

const textMeta = (overrides: Partial<TTextFieldMeta> = {}): TTextFieldMeta => ({
  type: 'text',
  label: 'Label',
  required: true,
  readOnly: false,
  fontSize: 12,
  textAlign: 'left',
  ...overrides,
});

describe('removeFieldGroupValidation', () => {
  it('removes the validation rule from checkbox meta and keeps everything else', () => {
    const result = removeFieldGroupValidation(
      FieldType.CHECKBOX,
      checkboxMeta({ validationRule: 'Select at least', validationLength: 2, required: true, fontSize: 20 }),
    );

    assert(result?.type === 'checkbox');
    expect(result.validationRule).toBeUndefined();
    expect(result.validationLength).toBeUndefined();
    expect(result.required).toBe(true);
    expect(result.fontSize).toBe(20);
  });
});

describe('reconcileFieldGroup', () => {
  const checkboxItem = (id: number, value: string, overrides: Partial<TCheckboxFieldMeta> = {}) => ({
    id,
    formId: `f${id}`,
    type: FieldType.CHECKBOX,
    recipientId: 1,
    groupId: 'g',
    fieldMeta: checkboxMeta({
      validationRule: 'Select at least',
      validationLength: 2,
      values: [{ id, checked: false, value }],
      ...overrides,
    }),
  });

  const radioItem = (id: number, checked: boolean) => ({
    id,
    formId: `f${id}`,
    type: FieldType.RADIO,
    recipientId: 1,
    groupId: 'g',
    fieldMeta: radioMeta({ values: [{ id, checked, value: `Option ${id}` }] }),
  });

  it('returns no updates when the group is already valid and in sync', () => {
    const result = reconcileFieldGroup({ groupId: 'g', items: [checkboxItem(1, 'A'), checkboxItem(2, 'B')] });

    expect(result.updates).toEqual([]);
    expect(result.isValidationRemoved).toBe(false);
  });

  it('copies the shared meta from the source field to the other fields', () => {
    const source = checkboxItem(1, 'A', { validationLength: 1, required: true });
    const sibling = checkboxItem(2, 'B', { fontSize: 30 });

    const result = reconcileFieldGroup({ groupId: 'g', items: [source, sibling], sourceFormId: 'f1' });

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].item.formId).toBe('f2');

    const fieldMeta = result.updates[0].fieldMeta;

    assert(fieldMeta?.type === 'checkbox');
    expect(fieldMeta.validationLength).toBe(1);
    expect(fieldMeta.required).toBe(true);
    // Visual meta remains per field.
    expect(fieldMeta.fontSize).toBe(30);
    expect(fieldMeta.values).toEqual([{ id: 2, checked: false, value: 'B' }]);
  });

  it('removes the validation rule when the options across the group no longer satisfy it', () => {
    const result = reconcileFieldGroup({ groupId: 'g', items: [checkboxItem(1, 'A')] });

    expect(result.isValidationRemoved).toBe(true);
    expect(result.updates).toHaveLength(1);

    const fieldMeta = result.updates[0].fieldMeta;

    assert(fieldMeta?.type === 'checkbox');
    expect(fieldMeta.validationRule).toBeUndefined();
    expect(fieldMeta.validationLength).toBeUndefined();
  });

  it('keeps only the source radio selection when more than one field is checked', () => {
    const result = reconcileFieldGroup({
      groupId: 'g',
      items: [radioItem(1, true), radioItem(2, true)],
      sourceFormId: 'f2',
    });

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].item.formId).toBe('f1');

    const fieldMeta = result.updates[0].fieldMeta;

    assert(fieldMeta?.type === 'radio');
    expect(fieldMeta.values?.map((value) => value.checked)).toEqual([false]);
  });

  it('keeps the first radio selection when there is no source', () => {
    const result = reconcileFieldGroup({ groupId: 'g', items: [radioItem(1, true), radioItem(2, true)] });

    expect(result.updates.map(({ item }) => item.formId)).toEqual(['f2']);
  });

  it('leaves unresolvable groups untouched', () => {
    const result = reconcileFieldGroup({
      groupId: 'g',
      items: [
        { formId: 'f1', type: FieldType.TEXT, recipientId: 1, groupId: 'g', fieldMeta: textMeta() },
        { formId: 'f2', type: FieldType.TEXT, recipientId: 2, groupId: 'g', fieldMeta: textMeta() },
      ],
    });

    expect(result.updates).toEqual([]);
    expect(result.isValidationRemoved).toBe(false);
  });
});

describe('reconcileFieldGroupsAfterRemoval', () => {
  const checkboxField = (id: number, groupId: string, validationLength: number) => ({
    id,
    type: FieldType.CHECKBOX,
    recipientId: 1,
    groupId,
    fieldMeta: checkboxMeta({
      validationRule: 'Select at least',
      validationLength,
      values: [{ id, checked: false, value: `Option ${id}` }],
    }),
  });

  it('removes the rule from a group which can no longer satisfy it', () => {
    // The group had three fields with one option each, and one was removed.
    const result = reconcileFieldGroupsAfterRemoval({
      remainingFields: [checkboxField(1, 'g', 3), checkboxField(2, 'g', 3)],
      groupIds: ['g'],
    });

    expect(Array.from(result.keys())).toEqual([1, 2]);

    for (const fieldMeta of result.values()) {
      assert(fieldMeta?.type === 'checkbox');

      // Not just undefined: the stored JSON must not carry the keys at all.
      expect(Object.keys(fieldMeta)).not.toContain('validationRule');
      expect(Object.keys(fieldMeta)).not.toContain('validationLength');
      expect(fieldMeta.values).toHaveLength(1);
    }
  });

  it('keeps the rule of a group which still satisfies it', () => {
    const result = reconcileFieldGroupsAfterRemoval({
      remainingFields: [checkboxField(1, 'g', 2), checkboxField(2, 'g', 2)],
      groupIds: ['g'],
    });

    expect(result.size).toBe(0);
  });

  it('only touches the groups it is asked to check', () => {
    const result = reconcileFieldGroupsAfterRemoval({
      remainingFields: [checkboxField(1, 'lost-a-field', 2), checkboxField(2, 'untouched', 2)],
      groupIds: ['lost-a-field'],
    });

    expect(Array.from(result.keys())).toEqual([1]);
  });
});
