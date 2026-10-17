import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { AppError } from '../errors/app-error';
import type { TCheckboxFieldMeta, TRadioFieldMeta, TTextFieldMeta } from '../types/field-meta';
import {
  assertFieldGroupAllowedForType,
  assertFieldGroupsValid,
  canFieldTypeBeGrouped,
  extractFieldGroupSharedMeta,
  generateFieldGroupId,
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

describe('canFieldTypeBeGrouped', () => {
  it('disallows signature, free signature, initials and date fields', () => {
    expect(canFieldTypeBeGrouped(FieldType.SIGNATURE)).toBe(false);
    expect(canFieldTypeBeGrouped(FieldType.FREE_SIGNATURE)).toBe(false);
    expect(canFieldTypeBeGrouped(FieldType.INITIALS)).toBe(false);
    expect(canFieldTypeBeGrouped(FieldType.DATE)).toBe(false);
  });

  it('allows the remaining field types', () => {
    expect(canFieldTypeBeGrouped(FieldType.TEXT)).toBe(true);
    expect(canFieldTypeBeGrouped(FieldType.NUMBER)).toBe(true);
    expect(canFieldTypeBeGrouped(FieldType.CHECKBOX)).toBe(true);
    expect(canFieldTypeBeGrouped(FieldType.RADIO)).toBe(true);
    expect(canFieldTypeBeGrouped(FieldType.DROPDOWN)).toBe(true);
    expect(canFieldTypeBeGrouped(FieldType.NAME)).toBe(true);
    expect(canFieldTypeBeGrouped(FieldType.EMAIL)).toBe(true);
  });
});

describe('assertFieldGroupAllowedForType', () => {
  it('throws when a signature field has a group id', () => {
    expect(() => assertFieldGroupAllowedForType(FieldType.SIGNATURE, 'group-1')).toThrow(AppError);
    expect(() => assertFieldGroupAllowedForType(FieldType.DATE, 'group-1')).toThrow(AppError);
    expect(() => assertFieldGroupAllowedForType(FieldType.INITIALS, 'group-1')).toThrow(AppError);
  });

  it('does not throw when no group id is provided', () => {
    expect(() => assertFieldGroupAllowedForType(FieldType.SIGNATURE, null)).not.toThrow();
    expect(() => assertFieldGroupAllowedForType(FieldType.SIGNATURE, undefined)).not.toThrow();
  });
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

  it('omits null and undefined values', () => {
    const shared = extractFieldGroupSharedMeta(FieldType.NUMBER, {
      type: 'number',
      minValue: null,
      maxValue: undefined,
      required: true,
    });

    expect(shared).toEqual({ required: true });
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

    expect(resolved?.type).toBe('text');

    if (resolved?.type === 'text') {
      expect(resolved.characterLimit).toBe(5);
      expect(resolved.label).toBe('Label');
    }
  });
});

describe('validateFieldGroup', () => {
  it('rejects groups containing non-groupable field types', () => {
    const errors = validateFieldGroup('g', [
      { type: FieldType.SIGNATURE, recipientId: 1, groupId: 'g', fieldMeta: { type: 'signature' } },
    ]);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('cannot be grouped');
  });

  it('rejects groups with mixed field types', () => {
    const errors = validateFieldGroup('g', [
      { type: FieldType.TEXT, recipientId: 1, groupId: 'g', fieldMeta: textMeta() },
      { type: FieldType.NUMBER, recipientId: 1, groupId: 'g', fieldMeta: { type: 'number' } },
    ]);

    expect(errors[0]).toContain('same type');
  });

  it('rejects groups spanning multiple recipients', () => {
    const errors = validateFieldGroup('g', [
      { type: FieldType.TEXT, recipientId: 1, groupId: 'g', fieldMeta: textMeta() },
      { type: FieldType.TEXT, recipientId: 2, groupId: 'g', fieldMeta: textMeta() },
    ]);

    expect(errors.some((error) => error.includes('same recipient'))).toBe(true);
  });

  it('rejects mismatched shared meta', () => {
    const errors = validateFieldGroup('g', [
      { type: FieldType.TEXT, recipientId: 1, groupId: 'g', fieldMeta: textMeta({ characterLimit: 10 }) },
      { type: FieldType.TEXT, recipientId: 1, groupId: 'g', fieldMeta: textMeta({ characterLimit: 20 }) },
    ]);

    expect(errors.some((error) => error.includes('must be identical'))).toBe(true);
  });

  it('allows differing visual meta', () => {
    const errors = validateFieldGroup('g', [
      { type: FieldType.TEXT, recipientId: 1, groupId: 'g', fieldMeta: textMeta({ fontSize: 10 }) },
      { type: FieldType.TEXT, recipientId: 1, groupId: 'g', fieldMeta: textMeta({ fontSize: 30, textAlign: 'right' }) },
    ]);

    expect(errors).toEqual([]);
  });

  it('pools checkbox options when evaluating validation rules', () => {
    const members = [
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
    expect(validateFieldGroup('g', members)).toEqual([]);

    // A single member on its own does not have enough pooled options.
    expect(validateFieldGroup('g', [members[0]]).some((error) => error.includes('at least 2'))).toBe(true);
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

  it('throws an AppError when any group is invalid', () => {
    expect(() =>
      assertFieldGroupsValid([
        { type: FieldType.TEXT, recipientId: 1, groupId: 'g', fieldMeta: textMeta({ characterLimit: 1 }) },
        { type: FieldType.TEXT, recipientId: 1, groupId: 'g', fieldMeta: textMeta({ characterLimit: 2 }) },
      ]),
    ).toThrow(AppError);
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

describe('generateFieldGroupId', () => {
  it('generates ids in the form grp_xxxx', () => {
    expect(generateFieldGroupId()).toMatch(/^grp_[a-z]{4}$/);
    expect(generateFieldGroupId()).not.toBe(generateFieldGroupId());
  });

  it('avoids existing ids', () => {
    const existing = generateFieldGroupId();

    expect(generateFieldGroupId([existing])).not.toBe(existing);
  });
});
