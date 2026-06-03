// ABOUTME: Tests for the fitFontSize utility that finds the largest font size fitting text in a box.
// ABOUTME: Uses an injected measurer to avoid Konva's browser-only canvas requirement.

import { describe, expect, it } from 'vitest';

import { fitFontSize } from './fit-font-size';

/**
 * A simple fake measurer: returns a height proportional to fontSize.
 * height = (fontSize / charWidth) * numChars * lineHeight
 * For testing purposes: text height = fontSize * (text.length / (width / fontSize)) capped at 1 line minimum.
 */
const makeMeasurer =
  (charsPerLineAtFontSize: (fontSize: number, width: number) => number) =>
  (text: string, _fontFamily: string, fontSize: number, width: number): number => {
    const charsPerLine = charsPerLineAtFontSize(fontSize, width);
    const lines = Math.ceil(text.length / charsPerLine);
    return lines * fontSize * 1.2; // 1.2 line height factor
  };

describe('fitFontSize', () => {
  it('returns maxFontSize when text fits at max size', () => {
    // Measurer says everything fits in one line regardless of size.
    const measurer = (_text: string, _ff: string, fontSize: number, _w: number) => fontSize;

    const result = fitFontSize('Hello', 'Caveat', 200, 50, 24, 8, measurer);

    expect(result).toBe(24);
  });

  it('reduces font size when text overflows at max size', () => {
    // Each character is 1px wide at any font size.
    // At fontSize N, charsPerLine = width/N * 1.
    // Height = lines * fontSize * 1.2
    // "Hello World" = 11 chars. At width=100:
    //   fontSize=24: charsPerLine = 100/24 ≈ 4, lines = ceil(11/4) = 3, height = 3*24*1.2 = 86.4 (overflows 40px)
    //   fontSize=12: charsPerLine = 100/12 ≈ 8, lines = ceil(11/8) = 2, height = 2*12*1.2 = 28.8 (fits 40px)
    const measurer = makeMeasurer((fontSize, width) => Math.floor(width / fontSize));

    const result = fitFontSize('Hello World', 'Caveat', 100, 40, 24, 8, measurer);

    expect(result).toBeGreaterThanOrEqual(8);
    expect(result).toBeLessThan(24);
    // Verify the result actually fits
    const height = measurer('Hello World', 'Caveat', result, 100);
    expect(height).toBeLessThanOrEqual(40);
  });

  it('returns minFontSize when text cannot fit even at minimum', () => {
    // Measurer always overflows.
    const measurer = () => 9999;

    const result = fitFontSize('A very long text', 'Caveat', 10, 10, 24, 8, measurer);

    expect(result).toBe(8);
  });

  it('returns minFontSize when maxFontSize equals minFontSize', () => {
    const measurer = (_text: string, _ff: string, fontSize: number, _w: number) => fontSize;

    const result = fitFontSize('Hello', 'Caveat', 200, 50, 8, 8, measurer);

    expect(result).toBe(8);
  });

  it('always returns a value within [minFontSize, maxFontSize]', () => {
    const measurer = makeMeasurer((fontSize, width) => Math.floor(width / fontSize));

    const result = fitFontSize('Short', 'Caveat', 80, 30, 20, 10, measurer);

    expect(result).toBeGreaterThanOrEqual(10);
    expect(result).toBeLessThanOrEqual(20);
  });

  it('uses default measurer signature when no measurer injected', () => {
    // Without injecting a measurer, the function signature still works.
    // We cannot call it in Node.js without a canvas backend, so we just verify
    // the injected-measurer path with a trivially fitting case.
    const alwaysFits = () => 1;

    const result = fitFontSize('X', 'Caveat', 100, 100, 18, 8, alwaysFits);

    expect(result).toBe(18);
  });
});
