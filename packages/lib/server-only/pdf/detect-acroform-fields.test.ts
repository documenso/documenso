import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { mapAcroFormFieldType, widgetRectToPercentages } from './detect-acroform-fields';

describe('mapAcroFormFieldType', () => {
  it('maps known AcroForm field types to Documenso field types', () => {
    expect(mapAcroFormFieldType('text')).toBe(FieldType.TEXT);
    expect(mapAcroFormFieldType('checkbox')).toBe(FieldType.CHECKBOX);
    expect(mapAcroFormFieldType('radio')).toBe(FieldType.RADIO);
    expect(mapAcroFormFieldType('dropdown')).toBe(FieldType.DROPDOWN);
    expect(mapAcroFormFieldType('listbox')).toBe(FieldType.DROPDOWN);
    expect(mapAcroFormFieldType('signature')).toBe(FieldType.SIGNATURE);
  });

  it('returns null for unsupported field types', () => {
    expect(mapAcroFormFieldType('button')).toBeNull();
    expect(mapAcroFormFieldType('unknown')).toBeNull();
    expect(mapAcroFormFieldType('non-terminal')).toBeNull();
  });
});

describe('widgetRectToPercentages', () => {
  const pageWidth = 200;
  const pageHeight = 400;

  it('converts a bottom-left-origin rect into top-left percentages', () => {
    // A 20x40 widget whose bottom-left corner is at (20, 320) in PDF space.
    const result = widgetRectToPercentages([20, 320, 40, 360], pageWidth, pageHeight);

    expect(result.positionX).toBeCloseTo(10);
    // top = 400 - 320 - 40 = 40 -> 40 / 400 = 10%
    expect(result.positionY).toBeCloseTo(10);
    expect(result.width).toBeCloseTo(10);
    expect(result.height).toBeCloseTo(10);
  });

  it('normalizes rects given with reversed corners', () => {
    const result = widgetRectToPercentages([40, 360, 20, 320], pageWidth, pageHeight);

    expect(result.positionX).toBeCloseTo(10);
    expect(result.positionY).toBeCloseTo(10);
    expect(result.width).toBeCloseTo(10);
    expect(result.height).toBeCloseTo(10);
  });

  it('falls back to default dimensions for degenerate rects', () => {
    const result = widgetRectToPercentages([10, 200, 10, 200], pageWidth, pageHeight);

    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('clamps positions and sizes to stay within the page', () => {
    const result = widgetRectToPercentages([180, 0, 260, 80], pageWidth, pageHeight);

    expect(result.positionX).toBeGreaterThanOrEqual(0);
    expect(result.positionX).toBeLessThanOrEqual(100);
    expect(result.positionX + result.width).toBeLessThanOrEqual(100.0001);
    expect(result.positionY + result.height).toBeLessThanOrEqual(100.0001);
  });
});
