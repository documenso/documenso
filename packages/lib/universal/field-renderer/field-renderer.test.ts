// ABOUTME: Unit tests for calculateMultiItemPosition in field-renderer.ts
// ABOUTME: Covers vertical, horizontal, and custom direction modes for checkbox and radio types.
import { describe, expect, it } from 'vitest';

import { calculateMultiItemPosition } from './field-renderer';

const baseOptions = {
  fieldWidth: 200,
  fieldHeight: 100,
  itemCount: 2,
  itemSize: 12,
  spacingBetweenItemAndText: 8,
  fieldPadding: 8,
};

describe('calculateMultiItemPosition – vertical direction', () => {
  it('positions checkbox item 0 at the top slot', () => {
    const result = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 0,
      direction: 'vertical',
      type: 'checkbox',
    });

    // Inner field: y starts at fieldPadding=8; each slot height = (100-16)/2 = 42
    // item 0: y = 8; itemInputY = 8 + 42/2 - 12/2 = 8 + 21 - 6 = 23
    expect(result.itemInputY).toBeCloseTo(23);
    expect(result.itemInputX).toBe(8); // innerFieldX = fieldPadding
  });

  it('positions checkbox item 1 at the bottom slot', () => {
    const result = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 1,
      direction: 'vertical',
      type: 'checkbox',
    });

    // item 1: y = 42 + 8 = 50; itemInputY = 50 + 21 - 6 = 65
    expect(result.itemInputY).toBeCloseTo(65);
  });

  it('positions radio item center differently', () => {
    const result = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 0,
      direction: 'vertical',
      type: 'radio',
    });

    // radio: itemInputX = innerFieldX + itemSize/2 = 8 + 6 = 14
    // itemInputY = y + itemHeight/2 = 8 + 21 = 29
    expect(result.itemInputX).toBeCloseTo(14);
    expect(result.itemInputY).toBeCloseTo(29);
  });
});

describe('calculateMultiItemPosition – horizontal direction', () => {
  it('positions items side by side', () => {
    const result0 = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 0,
      direction: 'horizontal',
      type: 'checkbox',
    });

    const result1 = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 1,
      direction: 'horizontal',
      type: 'checkbox',
    });

    // Inner field width = 200 - 8 = 192; item width = 192 / 2 = 96
    // item 0: x = 0 * 96 + 8 = 8
    // item 1: x = 1 * 96 + 8 = 104
    expect(result0.itemInputX).toBeCloseTo(8);
    expect(result1.itemInputX).toBeCloseTo(104);
  });
});

describe('calculateMultiItemPosition – custom direction', () => {
  it('uses vertical slot base position when no offset provided', () => {
    const custom = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 0,
      direction: 'custom',
      type: 'checkbox',
    });

    const vertical = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 0,
      direction: 'vertical',
      type: 'checkbox',
    });

    expect(custom.itemInputX).toBeCloseTo(vertical.itemInputX);
    expect(custom.itemInputY).toBeCloseTo(vertical.itemInputY);
  });

  it('applies offsetX to itemInputX', () => {
    const result = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 0,
      direction: 'custom',
      type: 'checkbox',
      item: { offsetX: 20 },
    });

    const baseline = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 0,
      direction: 'custom',
      type: 'checkbox',
    });

    expect(result.itemInputX).toBeCloseTo(baseline.itemInputX + 20);
  });

  it('applies offsetY to itemInputY', () => {
    const result = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 0,
      direction: 'custom',
      type: 'checkbox',
      item: { offsetY: 10 },
    });

    const baseline = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 0,
      direction: 'custom',
      type: 'checkbox',
    });

    expect(result.itemInputY).toBeCloseTo(baseline.itemInputY + 10);
  });

  it('applies both offsets independently', () => {
    const result = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 1,
      direction: 'custom',
      type: 'checkbox',
      item: { offsetX: 15, offsetY: -5 },
    });

    const baseline = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 1,
      direction: 'custom',
      type: 'checkbox',
    });

    expect(result.itemInputX).toBeCloseTo(baseline.itemInputX + 15);
    expect(result.itemInputY).toBeCloseTo(baseline.itemInputY - 5);
  });

  it('shifts text position by offsetX as well', () => {
    const result = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 0,
      direction: 'custom',
      type: 'checkbox',
      item: { offsetX: 30 },
    });

    const baseline = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 0,
      direction: 'custom',
      type: 'checkbox',
    });

    expect(result.textX).toBeCloseTo(baseline.textX + 30);
  });

  it('handles radio type offset for centered circle positioning', () => {
    const result = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 0,
      direction: 'custom',
      type: 'radio',
      item: { offsetX: 10, offsetY: 5 },
    });

    const baseline = calculateMultiItemPosition({
      ...baseOptions,
      itemIndex: 0,
      direction: 'custom',
      type: 'radio',
    });

    expect(result.itemInputX).toBeCloseTo(baseline.itemInputX + 10);
    expect(result.itemInputY).toBeCloseTo(baseline.itemInputY + 5);
  });
});

describe('ZRadioFieldMeta schema', () => {
  it('accepts direction: custom', async () => {
    const { ZRadioFieldMeta } = await import('../../types/field-meta');

    const result = ZRadioFieldMeta.safeParse({
      type: 'radio',
      direction: 'custom',
      values: [{ id: 1, checked: false, value: 'A', offsetX: 10, offsetY: 5 }],
    });

    expect(result.success).toBe(true);
  });

  it('accepts values items without offset fields', async () => {
    const { ZRadioFieldMeta } = await import('../../types/field-meta');

    const result = ZRadioFieldMeta.safeParse({
      type: 'radio',
      direction: 'vertical',
      values: [{ id: 1, checked: false, value: 'Option' }],
    });

    expect(result.success).toBe(true);
  });
});

describe('ZCheckboxFieldMeta schema', () => {
  it('accepts direction: custom', async () => {
    const { ZCheckboxFieldMeta } = await import('../../types/field-meta');

    const result = ZCheckboxFieldMeta.safeParse({
      type: 'checkbox',
      direction: 'custom',
      values: [{ id: 1, checked: false, value: 'A', offsetX: 10, offsetY: 5 }],
    });

    expect(result.success).toBe(true);
  });

  it('rejects unknown direction values', async () => {
    const { ZCheckboxFieldMeta } = await import('../../types/field-meta');

    const result = ZCheckboxFieldMeta.safeParse({
      type: 'checkbox',
      direction: 'diagonal',
    });

    expect(result.success).toBe(false);
  });
});
