import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { TCheckboxFieldMeta, TRadioFieldMeta, TTextFieldMeta } from '../types/field-meta';
import { reconcileFieldGroup, removeFieldGroupValidation } from './field-group-reconciliation';

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

    expect(result?.type).toBe('checkbox');

    if (result?.type === 'checkbox') {
      expect(result.validationRule).toBeUndefined();
      expect(result.validationLength).toBeUndefined();
      expect(result.required).toBe(true);
      expect(result.fontSize).toBe(20);
    }
  });

  it('leaves non-checkbox meta untouched', () => {
    const meta = textMeta({ characterLimit: 5 });

    expect(removeFieldGroupValidation(FieldType.TEXT, meta)).toEqual(meta);
  });
});

describe('reconcileFieldGroup', () => {
  const checkboxMember = (id: number, value: string, overrides: Partial<TCheckboxFieldMeta> = {}) => ({
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

  const radioMember = (id: number, checked: boolean) => ({
    id,
    formId: `f${id}`,
    type: FieldType.RADIO,
    recipientId: 1,
    groupId: 'g',
    fieldMeta: radioMeta({ values: [{ id, checked, value: `Option ${id}` }] }),
  });

  it('returns no updates when the group is already valid and in sync', () => {
    const result = reconcileFieldGroup({ groupId: 'g', members: [checkboxMember(1, 'A'), checkboxMember(2, 'B')] });

    expect(result.updates).toEqual([]);
    expect(result.isValidationRemoved).toBe(false);
  });

  it('returns no updates when there are no members', () => {
    expect(reconcileFieldGroup({ groupId: 'g', members: [] })).toEqual({ updates: [], isValidationRemoved: false });
  });

  it('copies the shared meta from the source member to the other members', () => {
    const source = checkboxMember(1, 'A', { validationLength: 1, required: true });
    const sibling = checkboxMember(2, 'B', { fontSize: 30 });

    const result = reconcileFieldGroup({ groupId: 'g', members: [source, sibling], sourceFormId: 'f1' });

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].member.formId).toBe('f2');

    const fieldMeta = result.updates[0].fieldMeta;

    if (fieldMeta?.type === 'checkbox') {
      expect(fieldMeta.validationLength).toBe(1);
      expect(fieldMeta.required).toBe(true);
      // Visual meta remains per field.
      expect(fieldMeta.fontSize).toBe(30);
      expect(fieldMeta.values).toEqual([{ id: 2, checked: false, value: 'B' }]);
    }
  });

  it('removes the validation rule when the pooled options no longer satisfy it', () => {
    const result = reconcileFieldGroup({ groupId: 'g', members: [checkboxMember(1, 'A')] });

    expect(result.isValidationRemoved).toBe(true);
    expect(result.updates).toHaveLength(1);

    const fieldMeta = result.updates[0].fieldMeta;

    if (fieldMeta?.type === 'checkbox') {
      expect(fieldMeta.validationRule).toBeUndefined();
      expect(fieldMeta.validationLength).toBeUndefined();
    }
  });

  it('keeps only the source radio selection when more than one member is checked', () => {
    const result = reconcileFieldGroup({
      groupId: 'g',
      members: [radioMember(1, true), radioMember(2, true)],
      sourceFormId: 'f2',
    });

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].member.formId).toBe('f1');

    const fieldMeta = result.updates[0].fieldMeta;

    if (fieldMeta?.type === 'radio') {
      expect(fieldMeta.values?.every((value) => !value.checked)).toBe(true);
    }
  });

  it('keeps the first radio selection when there is no source', () => {
    const result = reconcileFieldGroup({ groupId: 'g', members: [radioMember(1, true), radioMember(2, true)] });

    expect(result.updates.map(({ member }) => member.formId)).toEqual(['f2']);
  });

  it('leaves unresolvable groups untouched', () => {
    const result = reconcileFieldGroup({
      groupId: 'g',
      members: [
        { formId: 'f1', type: FieldType.TEXT, recipientId: 1, groupId: 'g', fieldMeta: textMeta() },
        { formId: 'f2', type: FieldType.TEXT, recipientId: 2, groupId: 'g', fieldMeta: textMeta() },
      ],
    });

    expect(result.updates).toEqual([]);
    expect(result.isValidationRemoved).toBe(false);
  });
});
