import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { inferFontMimeType, isSupportedFontMimeType, parseFontFile } from './font-file';

const originalCwd = process.cwd();
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('parseFontFile', () => {
  beforeEach(() => {
    process.chdir(packageRoot);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('extracts a font family from a valid font file', () => {
    const bytes = fs.readFileSync(path.join('..', 'assets', 'fonts', 'caveat.ttf'));

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
    const parseInvalidFont = () =>
      parseFontFile({
        bytes: Buffer.from('not a font'),
        fallbackName: 'broken.ttf',
      });

    expect(parseInvalidFont).toThrow(AppError);
    expect(parseInvalidFont).toThrow('Invalid font file');

    try {
      parseInvalidFont();
    } catch (error) {
      expect(error).toMatchObject({
        code: AppErrorCode.INVALID_BODY,
      });
    }
  });

  it('allows supported font mime types and empty browser mime types', () => {
    expect(isSupportedFontMimeType('font/ttf')).toBe(true);
    expect(isSupportedFontMimeType('font/otf')).toBe(true);
    expect(isSupportedFontMimeType('')).toBe(true);
    expect(isSupportedFontMimeType('application/pdf')).toBe(false);
  });

  it('infers font mime types from file extensions', () => {
    expect(inferFontMimeType('font.otf')).toBe('font/otf');
    expect(inferFontMimeType('font.ttf')).toBe('font/ttf');
  });
});
