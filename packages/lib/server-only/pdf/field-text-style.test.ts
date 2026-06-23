import { describe, expect, it } from 'vitest';

import { getPdfTextStyleDrawingOptions, hasPdfTextStyle } from './field-text-style';

describe('PDF field text style', () => {
  it('does not synthesize style for normal text', () => {
    expect(hasPdfTextStyle({ fontWeight: 'normal', fontStyle: 'normal' })).toBe(false);
    expect(getPdfTextStyleDrawingOptions({ fontWeight: 'normal', fontStyle: 'normal' })).toEqual({
      offsets: [{ x: 0, y: 0 }],
      xSkewDegrees: 0,
    });
  });

  it('adds synthetic bold offsets for bold text', () => {
    expect(hasPdfTextStyle({ fontWeight: 'bold' })).toBe(true);
    expect(getPdfTextStyleDrawingOptions({ fontWeight: 'bold' }).offsets.length).toBeGreaterThan(1);
  });

  it('adds synthetic italic skew for italic text', () => {
    expect(hasPdfTextStyle({ fontStyle: 'italic' })).toBe(true);
    expect(getPdfTextStyleDrawingOptions({ fontStyle: 'italic' }).xSkewDegrees).not.toBe(0);
  });
});
