// ABOUTME: Unit tests for field-meta Zod schema changes.
// ABOUTME: Covers offsetX/offsetY bounds, custom direction, groupId constraints.
import { describe, expect, it } from 'vitest';

import {
  ZBaseFieldMeta,
  ZCheckboxFieldMeta,
  ZRadioFieldMeta,
} from './field-meta';

describe('ZBaseFieldMeta groupId', () => {
  it('accepts a valid groupId', () => {
    const result = ZBaseFieldMeta.safeParse({ groupId: 'group-1_test' });
    expect(result.success).toBe(true);
  });

  it('rejects groupId longer than 64 characters', () => {
    const result = ZBaseFieldMeta.safeParse({ groupId: 'a'.repeat(65) });
    expect(result.success).toBe(false);
  });

  it('rejects groupId with invalid characters', () => {
    const result = ZBaseFieldMeta.safeParse({ groupId: 'group id with spaces!' });
    expect(result.success).toBe(false);
  });

  it('accepts missing groupId (backward compat)', () => {
    const result = ZBaseFieldMeta.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('ZCheckboxFieldMeta offsets', () => {
  const baseCheckbox = { type: 'checkbox' as const };

  it('accepts values with valid offsets', () => {
    const result = ZCheckboxFieldMeta.safeParse({
      ...baseCheckbox,
      values: [{ id: 1, checked: false, value: 'Option A', offsetX: 10, offsetY: -5 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects offsetX above 100', () => {
    const result = ZCheckboxFieldMeta.safeParse({
      ...baseCheckbox,
      values: [{ id: 1, checked: false, value: 'A', offsetX: 101 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects offsetY below -100', () => {
    const result = ZCheckboxFieldMeta.safeParse({
      ...baseCheckbox,
      values: [{ id: 1, checked: false, value: 'A', offsetY: -101 }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts values without offsets (backward compat)', () => {
    const result = ZCheckboxFieldMeta.safeParse({
      ...baseCheckbox,
      values: [{ id: 1, checked: false, value: 'A' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts custom direction', () => {
    const result = ZCheckboxFieldMeta.safeParse({
      ...baseCheckbox,
      direction: 'custom',
    });
    expect(result.success).toBe(true);
  });

  it('defaults direction to vertical', () => {
    const result = ZCheckboxFieldMeta.parse(baseCheckbox);
    expect(result.direction).toBe('vertical');
  });
});

describe('ZRadioFieldMeta offsets', () => {
  const baseRadio = { type: 'radio' as const };

  it('accepts values with valid offsets', () => {
    const result = ZRadioFieldMeta.safeParse({
      ...baseRadio,
      values: [{ id: 1, checked: false, value: 'Option A', offsetX: 50, offsetY: 25 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects out-of-bounds offsets', () => {
    const result = ZRadioFieldMeta.safeParse({
      ...baseRadio,
      values: [{ id: 1, checked: false, value: 'A', offsetX: 200 }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts custom direction', () => {
    const result = ZRadioFieldMeta.safeParse({
      ...baseRadio,
      direction: 'custom',
    });
    expect(result.success).toBe(true);
  });
});
