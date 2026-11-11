import { FieldType } from '@prisma/client';
import { assert, describe, expect, it } from 'vitest';

import type { TCheckboxFieldMeta, TRadioFieldMeta, TTextFieldMeta } from '../types/field-meta';
import {
  assertFieldGroupsValid,
  extractFieldGroupSharedMeta,
  mergeFieldGroupSharedMeta,
  resolveSyncedSiblingFieldMeta,
  validateFieldGroup,
} from './field-groups';

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

describe('extractFieldGroupSharedMeta', () => {
  it('only extracts the shared keys for the field type', () => {
    const shared = extractFieldGroupSharedMeta(
      FieldType.CHECKBOX,
      checkboxMeta({ validationRule: 'Select at least', validationLength: 2, fontSize: 20 }),
    );

    expect(shared).toEqual({
      required: false,
      readOnly: false,
      validationRule: 'Select at least',
      validationLength: 2,
    });
  });
});

describe('mergeFieldGroupSharedMeta', () => {
  it('overwrites shared keys and preserves per-field keys', () => {
    const target = checkboxMeta({
      values: [{ id: 1, checked: true, value: 'B' }],
      fontSize: 20,
      validationLength: 1,
    });

    const merged = mergeFieldGroupSharedMeta(
      FieldType.CHECKBOX,
      target,
      checkboxMeta({ validationRule: 'Select at least', validationLength: 3, required: true, fontSize: 8 }),
    );

    expect(merged.values).toEqual([{ id: 1, checked: true, value: 'B' }]);
    expect(merged.fontSize).toBe(20);
    expect(merged.validationRule).toBe('Select at least');
    expect(merged.validationLength).toBe(3);
    expect(merged.required).toBe(true);
  });

  it('removes shared keys that are absent on the source', () => {
    const target = textMeta({ characterLimit: 10 });

    const merged = mergeFieldGroupSharedMeta(FieldType.TEXT, target, textMeta());

    expect(merged.characterLimit).toBeUndefined();
  });
});

describe('resolveSyncedSiblingFieldMeta', () => {
  it('falls back to default meta when the sibling has none', () => {
    const resolved = resolveSyncedSiblingFieldMeta(FieldType.TEXT, null, textMeta({ characterLimit: 5 }));

    assert(resolved?.type === 'text');
    expect(resolved.characterLimit).toBe(5);
    expect(resolved.label).toBe('Label');
  });
});

describe('validateFieldGroup', () => {
  it('rejects mismatched shared meta', () => {
    const errors = validateFieldGroup('g', [
      { type: FieldType.TEXT, recipientId: 1, groupId: 'g', fieldMeta: textMeta({ characterLimit: 10 }) },
      { type: FieldType.TEXT, recipientId: 1, groupId: 'g', fieldMeta: textMeta({ characterLimit: 20 }) },
    ]);

    expect(errors.some((error) => error.includes('must be identical'))).toBe(true);
  });

  it('treats null and omitted shared values as identical', () => {
    const errors = validateFieldGroup('g', [
      { type: FieldType.NUMBER, recipientId: 1, groupId: 'g', fieldMeta: { type: 'number', minValue: null } },
      { type: FieldType.NUMBER, recipientId: 1, groupId: 'g', fieldMeta: { type: 'number' } },
    ]);

    expect(errors).toEqual([]);
  });

  it('allows differing visual meta', () => {
    const errors = validateFieldGroup('g', [
      { type: FieldType.TEXT, recipientId: 1, groupId: 'g', fieldMeta: textMeta({ fontSize: 10 }) },
      { type: FieldType.TEXT, recipientId: 1, groupId: 'g', fieldMeta: textMeta({ fontSize: 30, textAlign: 'right' }) },
    ]);

    expect(errors).toEqual([]);
  });

  it('pools checkbox options when evaluating validation rules', () => {
    const items = [
      {
        type: FieldType.CHECKBOX,
        recipientId: 1,
        groupId: 'g',
        fieldMeta: checkboxMeta({ validationRule: 'Select at least', validationLength: 2 }),
      },
      {
        type: FieldType.CHECKBOX,
        recipientId: 1,
        groupId: 'g',
        fieldMeta: checkboxMeta({
          validationRule: 'Select at least',
          validationLength: 2,
          values: [{ id: 2, checked: false, value: 'B' }],
        }),
      },
    ];

    // Each field only has 1 option but the pool has 2, which satisfies the rule.
    expect(validateFieldGroup('g', items)).toEqual([]);

    // A single field on its own does not have enough pooled options.
    expect(validateFieldGroup('g', [items[0]]).some((error) => error.includes('at least 2'))).toBe(true);
  });

  it('rejects radio groups with more than one pre-checked option', () => {
    const errors = validateFieldGroup('g', [
      {
        type: FieldType.RADIO,
        recipientId: 1,
        groupId: 'g',
        fieldMeta: radioMeta({ values: [{ id: 1, checked: true, value: 'A' }] }),
      },
      {
        type: FieldType.RADIO,
        recipientId: 1,
        groupId: 'g',
        fieldMeta: radioMeta({ values: [{ id: 2, checked: true, value: 'B' }] }),
      },
    ]);

    expect(errors.some((error) => error.includes('more than one checked'))).toBe(true);
  });

  it('allows radio groups with a single pre-checked option across the group', () => {
    const errors = validateFieldGroup('g', [
      {
        type: FieldType.RADIO,
        recipientId: 1,
        groupId: 'g',
        fieldMeta: radioMeta({ values: [{ id: 1, checked: true, value: 'A' }] }),
      },
      {
        type: FieldType.RADIO,
        recipientId: 1,
        groupId: 'g',
        fieldMeta: radioMeta({ values: [{ id: 2, checked: false, value: 'B' }] }),
      },
    ]);

    expect(errors).toEqual([]);
  });
});

describe('assertFieldGroupsValid', () => {
  it('ignores fields without a group id', () => {
    expect(() =>
      assertFieldGroupsValid([
        { type: FieldType.SIGNATURE, recipientId: 1, groupId: null, fieldMeta: { type: 'signature' } },
        { type: FieldType.TEXT, recipientId: 2, fieldMeta: textMeta() },
      ]),
    ).not.toThrow();
  });

  it('validates multiple groups independently', () => {
    expect(() =>
      assertFieldGroupsValid([
        { type: FieldType.TEXT, recipientId: 1, groupId: 'a', fieldMeta: textMeta({ characterLimit: 1 }) },
        { type: FieldType.TEXT, recipientId: 1, groupId: 'a', fieldMeta: textMeta({ characterLimit: 1 }) },
        { type: FieldType.NUMBER, recipientId: 2, groupId: 'b', fieldMeta: { type: 'number', minValue: 1 } },
        { type: FieldType.NUMBER, recipientId: 2, groupId: 'b', fieldMeta: { type: 'number', minValue: 1 } },
      ]),
    ).not.toThrow();
  });
});
