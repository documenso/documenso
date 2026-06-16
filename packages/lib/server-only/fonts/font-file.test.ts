import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { isSupportedFontMimeType, parseFontFile } from './font-file';

describe('parseFontFile', () => {
  it('extracts a font family from a valid font file', () => {
    const bytes = fs.readFileSync(path.join(process.cwd(), '../assets/fonts/caveat.ttf'));

    expect(
      parseFontFile({
        bytes,
        fallbackName: 'caveat.ttf',
      }),
    ).toMatchObject({
      family: 'Caveat Medium',
      name: 'Caveat Medium',
    });
  });

  it('rejects files that cannot be parsed as fonts', () => {
    expect(() =>
      parseFontFile({
        bytes: Buffer.from('not a font'),
        fallbackName: 'broken.ttf',
      }),
    ).toThrow('Invalid font file');
  });

  it('allows supported font mime types and empty browser mime types', () => {
    expect(isSupportedFontMimeType('font/ttf')).toBe(true);
    expect(isSupportedFontMimeType('font/otf')).toBe(true);
    expect(isSupportedFontMimeType('')).toBe(true);
    expect(isSupportedFontMimeType('application/pdf')).toBe(false);
  });
});
