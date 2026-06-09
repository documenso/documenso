import { describe, expect, it } from 'vitest';

import {
  getFieldCanvasStyleCacheKey,
  getOpacityValue,
  getPixelValue,
  getRenderableColor,
  TRANSPARENT_COLOR,
} from './field-canvas-style';
import type { FieldToRender } from './field-renderer';

const createField = (overrides: Partial<FieldToRender> = {}) =>
  ({
    type: 'SIGNATURE',
    inserted: false,
    fieldMeta: null,
    ...overrides,
  }) as FieldToRender;

describe('getPixelValue', () => {
  it('parses pixel values', () => {
    expect(getPixelValue('12px')).toBe(12);
    expect(getPixelValue('0px')).toBe(0);
    expect(getPixelValue('1.5px')).toBe(1.5);
  });

  it('parses unitless numeric strings', () => {
    expect(getPixelValue('42')).toBe(42);
  });

  it('returns undefined for non-finite or unparseable values', () => {
    expect(getPixelValue('')).toBeUndefined();
    expect(getPixelValue('auto')).toBeUndefined();
    expect(getPixelValue('inherit')).toBeUndefined();
    expect(getPixelValue('NaN')).toBeUndefined();
  });
});

describe('getOpacityValue', () => {
  it('returns undefined for fully opaque (the default) so callers fall back', () => {
    expect(getOpacityValue('1')).toBeUndefined();
  });

  it('keeps values inside the [0, 1) range as-is', () => {
    expect(getOpacityValue('0')).toBe(0);
    expect(getOpacityValue('0.5')).toBe(0.5);
    expect(getOpacityValue('0.999')).toBe(0.999);
  });

  it('clamps out-of-range values into [0, 1]', () => {
    expect(getOpacityValue('-0.5')).toBe(0);
    expect(getOpacityValue('2')).toBe(1);
  });

  it('returns undefined for non-finite values', () => {
    expect(getOpacityValue('')).toBeUndefined();
    expect(getOpacityValue('inherit')).toBeUndefined();
    expect(getOpacityValue('NaN')).toBeUndefined();
  });
});

describe('getRenderableColor', () => {
  it('passes non-transparent colors through unchanged', () => {
    expect(getRenderableColor('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)');
    expect(getRenderableColor('rgba(0, 128, 0, 0.5)')).toBe('rgba(0, 128, 0, 0.5)');
    expect(getRenderableColor('rgba(255, 255, 255, 0.9)')).toBe('rgba(255, 255, 255, 0.9)');
    expect(getRenderableColor('#abcdef')).toBe('#abcdef');
  });

  it('returns undefined for falsy input', () => {
    expect(getRenderableColor(undefined)).toBeUndefined();
    expect(getRenderableColor('')).toBeUndefined();
  });

  it('normalizes the `transparent` keyword to a renderable transparent color, regardless of case or whitespace', () => {
    expect(getRenderableColor('transparent')).toBe(TRANSPARENT_COLOR);
    expect(getRenderableColor('TRANSPARENT')).toBe(TRANSPARENT_COLOR);
    expect(getRenderableColor('  Transparent  ')).toBe(TRANSPARENT_COLOR);
  });

  it('normalizes fully transparent rgba() colors to a renderable transparent color', () => {
    expect(getRenderableColor('rgba(0, 0, 0, 0)')).toBe(TRANSPARENT_COLOR);
    expect(getRenderableColor('rgba(255, 0, 0, 0)')).toBe(TRANSPARENT_COLOR);
    expect(getRenderableColor('rgba(255, 0, 0, 0.0)')).toBe(TRANSPARENT_COLOR);
    expect(getRenderableColor('rgba(255, 0, 0, 0.00)')).toBe(TRANSPARENT_COLOR);
  });

  it('normalizes space-separated (CSS Color 4) fully transparent colors to a renderable transparent color', () => {
    expect(getRenderableColor('rgb(0 128 0 / 0)')).toBe(TRANSPARENT_COLOR);
    expect(getRenderableColor('rgba(255 0 0 / 0)')).toBe(TRANSPARENT_COLOR);
  });

  it('passes space-separated (CSS Color 4) colors through unchanged', () => {
    expect(getRenderableColor('rgb(0 128 0 / 0.5)')).toBe('rgb(0 128 0 / 0.5)');
  });

  it('returns undefined for unparseable color values', () => {
    expect(getRenderableColor('none')).toBeUndefined();
    expect(getRenderableColor('not-a-color')).toBeUndefined();
  });

  it('does not strip non-zero alpha colors', () => {
    expect(getRenderableColor('rgba(255, 0, 0, 0.5)')).toBe('rgba(255, 0, 0, 0.5)');
    expect(getRenderableColor('rgba(255, 0, 0, 1)')).toBe('rgba(255, 0, 0, 1)');
    expect(getRenderableColor('rgba(255, 0, 0, 0.01)')).toBe('rgba(255, 0, 0, 0.01)');
  });
});

describe('getFieldCanvasStyleCacheKey', () => {
  it('includes validation state', () => {
    expect(getFieldCanvasStyleCacheKey(createField({ isValidating: false }))).toBe('SIGNATURE:false:false:false');
    expect(getFieldCanvasStyleCacheKey(createField({ isValidating: true }))).toBe('SIGNATURE:false:false:true');
  });
});
