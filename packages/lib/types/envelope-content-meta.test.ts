import { describe, expect, it } from 'vitest';
import {
  CONTENT_MAX_Z_INDEX,
  ContentShapeType,
  EnvelopeContentType,
  normalizeContentRotation,
  ZContentColorSchema,
  ZContentHighlightMeta,
  ZContentLineMeta,
  ZContentRotationSchema,
  ZContentShapeMeta,
  ZContentTextMeta,
  ZContentZIndexSchema,
  ZEnvelopeContentMetaSchema,
} from './envelope-content-meta';

describe('normalizeContentRotation', () => {
  it('keeps in range values unchanged', () => {
    expect(normalizeContentRotation(0)).toBe(0);
    expect(normalizeContentRotation(90)).toBe(90);
    expect(normalizeContentRotation(359.5)).toBe(359.5);
  });

  it('wraps values outside the range', () => {
    expect(normalizeContentRotation(360)).toBe(0);
    expect(normalizeContentRotation(450)).toBe(90);
    expect(normalizeContentRotation(-90)).toBe(270);
    expect(normalizeContentRotation(-360)).toBe(0);
  });
});

describe('ZContentRotationSchema', () => {
  it('accepts the normalized range', () => {
    expect(ZContentRotationSchema.safeParse(0).success).toBe(true);
    expect(ZContentRotationSchema.safeParse(359.99).success).toBe(true);
  });

  it('rejects values outside the normalized range', () => {
    expect(ZContentRotationSchema.safeParse(360).success).toBe(false);
    expect(ZContentRotationSchema.safeParse(-1).success).toBe(false);
  });
});

describe('ZContentColorSchema', () => {
  it('accepts 3 and 6 digit hex colors', () => {
    expect(ZContentColorSchema.safeParse('#000').success).toBe(true);
    expect(ZContentColorSchema.safeParse('#FF00aa').success).toBe(true);
  });
  it('rejects invalid colors', () => {
    expect(ZContentColorSchema.safeParse('red').success).toBe(false);
    expect(ZContentColorSchema.safeParse('#12345').success).toBe(false);
    expect(ZContentColorSchema.safeParse('rgb(0,0,0)').success).toBe(false);
  });
});

describe('ZContentZIndexSchema', () => {
  it('accepts stacking orders within the supported range', () => {
    expect(ZContentZIndexSchema.safeParse(0).success).toBe(true);
    expect(ZContentZIndexSchema.safeParse(500).success).toBe(true);
    expect(ZContentZIndexSchema.safeParse(CONTENT_MAX_Z_INDEX).success).toBe(true);
  });

  // The column is an int4, and the next stacking order is the highest plus
  // one, so values near the type's ceiling would break every later placement.
  it('rejects values which would not fit the column or leave room above', () => {
    expect(ZContentZIndexSchema.safeParse(CONTENT_MAX_Z_INDEX + 1).success).toBe(false);
    expect(ZContentZIndexSchema.safeParse(2_147_483_647).success).toBe(false);
    expect(ZContentZIndexSchema.safeParse(2_147_483_648).success).toBe(false);
    expect(ZContentZIndexSchema.safeParse(-1).success).toBe(false);
    expect(ZContentZIndexSchema.safeParse(1.5).success).toBe(false);
  });
});

describe('content geometry', () => {
  // Values are stored as JSON, where non-finite numbers become null and then
  // fail to read back, so every numeric field must be bounded.
  it('accepts percentages within the page and integer page numbers', () => {
    const result = ZEnvelopeContentMetaSchema.safeParse({
      type: EnvelopeContentType.TEXT,
      page: 3,
      positionX: 0,
      positionY: 100,
      width: 12.5,
      height: 50,
    });

    expect(result.success).toBe(true);
  });

  it('rejects non-finite and out of page coordinates', () => {
    const text = (meta: Record<string, number>) =>
      ZEnvelopeContentMetaSchema.safeParse({ type: EnvelopeContentType.TEXT, ...meta }).success;

    const line = (meta: Record<string, number>) =>
      ZEnvelopeContentMetaSchema.safeParse({ type: EnvelopeContentType.LINE, ...meta }).success;

    expect(text({ positionX: Number.POSITIVE_INFINITY })).toBe(false);
    expect(text({ width: Number.NEGATIVE_INFINITY })).toBe(false);
    expect(text({ positionY: 100.5 })).toBe(false);
    expect(line({ endXPosition: Number.POSITIVE_INFINITY })).toBe(false);
    expect(line({ startYPosition: -1 })).toBe(false);
  });

  it('rejects non-integer page numbers', () => {
    const page = (value: number) =>
      ZEnvelopeContentMetaSchema.safeParse({ type: EnvelopeContentType.TEXT, page: value }).success;

    expect(page(1.5)).toBe(false);
    expect(page(0)).toBe(false);
    expect(page(Number.POSITIVE_INFINITY)).toBe(false);
    expect(page(Number.NaN)).toBe(false);
  });
});

describe('ZContentTextMeta', () => {
  it('allows color to be omitted', () => {
    const result = ZContentTextMeta.safeParse({ type: EnvelopeContentType.TEXT });
    expect(result.success).toBe(true);
    expect(result.success && result.data.color).toBeUndefined();
  });

  it('defaults rotation to zero', () => {
    const result = ZContentTextMeta.safeParse({ type: EnvelopeContentType.TEXT });
    expect(result.success && result.data.rotation).toBe(0);
  });
  it('parses through the union', () => {
    const result = ZEnvelopeContentMetaSchema.safeParse({ type: EnvelopeContentType.TEXT, color: '#abc' });
    expect(result.success).toBe(true);
  });
});

describe('ZContentLineMeta', () => {
  it('accepts stroke settings', () => {
    const result = ZContentLineMeta.safeParse({
      type: EnvelopeContentType.LINE,
      strokeWidth: 2,
      strokeColor: '#ff0000',
      strokeStyle: 'dashed',
    });

    expect(result.success).toBe(true);
  });

  it('rejects out of range stroke widths and unknown styles', () => {
    expect(ZContentLineMeta.safeParse({ type: EnvelopeContentType.LINE, strokeWidth: 0 }).success).toBe(false);
    expect(ZContentLineMeta.safeParse({ type: EnvelopeContentType.LINE, strokeWidth: 100 }).success).toBe(false);
    expect(ZContentLineMeta.safeParse({ type: EnvelopeContentType.LINE, strokeStyle: 'wavy' }).success).toBe(false);
  });
});

describe('ZContentShapeMeta', () => {
  it('accepts a rectangle with fill settings', () => {
    const result = ZContentShapeMeta.safeParse({
      type: EnvelopeContentType.SHAPE,
      shape: ContentShapeType.RECTANGLE,
      fillColor: '#abcdef',
      fillOpacity: 0.5,
    });

    expect(result.success).toBe(true);
  });

  it('requires a known shape', () => {
    expect(ZContentShapeMeta.safeParse({ type: EnvelopeContentType.SHAPE }).success).toBe(false);
    expect(ZContentShapeMeta.safeParse({ type: EnvelopeContentType.SHAPE, shape: 'hexagon' }).success).toBe(false);
  });

  it('rejects out of range opacity', () => {
    expect(
      ZContentShapeMeta.safeParse({
        type: EnvelopeContentType.SHAPE,
        shape: ContentShapeType.RECTANGLE,
        fillOpacity: 1.5,
      }).success,
    ).toBe(false);
  });

  it('no longer accepts the legacy rectangle content type', () => {
    expect(ZEnvelopeContentMetaSchema.safeParse({ type: 'rectangle' }).success).toBe(false);
  });
});

describe('ZContentHighlightMeta', () => {
  it('accepts color and opacity', () => {
    const result = ZContentHighlightMeta.safeParse({
      type: EnvelopeContentType.HIGHLIGHT,
      color: '#ffe600',
      opacity: 0.4,
    });

    expect(result.success).toBe(true);
  });
});
