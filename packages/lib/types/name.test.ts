import { describe, expect, it } from 'vitest';

import { ZNameSchema } from './name';

describe('ZNameSchema', () => {
  describe('valid names', () => {
    it('accepts a normal name', () => {
      expect(ZNameSchema.safeParse('Example User')).toEqual({
        success: true,
        data: 'Example User',
      });
    });

    it('accepts international characters', () => {
      expect(ZNameSchema.safeParse('Døcumensø Üser')).toEqual({
        success: true,
        data: 'Døcumensø Üser',
      });
    });

    it('trims surrounding whitespace', () => {
      expect(ZNameSchema.safeParse('  Documenso User  ')).toEqual({
        success: true,
        data: 'Documenso User',
      });
    });

    it('accepts names at the minimum length', () => {
      expect(ZNameSchema.safeParse('DU')).toEqual({
        success: true,
        data: 'DU',
      });
    });

    it('accepts names at the maximum length', () => {
      const name =
        'DocumensoUser DocumensoUser DocumensoUser DocumensoUser DocumensoUser DocumensoUser DocumensoUser Do';

      expect(name.length).toBe(100);
      expect(ZNameSchema.safeParse(name)).toEqual({
        success: true,
        data: name,
      });
    });
  });

  describe('length validation', () => {
    it('rejects names shorter than 2 characters', () => {
      expect(ZNameSchema.safeParse('D')).toMatchObject({
        success: false,
        error: {
          issues: [{ message: 'Please enter a valid name.' }],
        },
      });
    });

    it('rejects names longer than 100 characters', () => {
      const name =
        'DocumensoUser DocumensoUser DocumensoUser DocumensoUser DocumensoUser DocumensoUser DocumensoUser Doc';

      expect(name.length).toBe(101);
      expect(ZNameSchema.safeParse(name)).toMatchObject({
        success: false,
        error: {
          issues: [{ message: 'Name cannot be more than 100 characters.' }],
        },
      });
    });

    it('rejects whitespace-only input after trim', () => {
      expect(ZNameSchema.safeParse('   ')).toMatchObject({
        success: false,
      });
    });
  });

  describe('URL validation', () => {
    it.each([
      'https://example.com',
      'http://example.com',
      'HTTPS://EXAMPLE.COM',
      'Northwind www.example.com',
      'www.example.com',
    ])('rejects URLs in names: %s', (value) => {
      expect(ZNameSchema.safeParse(value)).toMatchObject({
        success: false,
        error: {
          issues: expect.arrayContaining([expect.objectContaining({ message: 'Name cannot contain URLs.' })]),
        },
      });
    });
  });

  describe('invalid character validation', () => {
    it.each([
      ['NUL character', 'Acme\u0000Corp'],
      ['zero-width space', 'Acme\u200bCorp'],
      ['bidi override', 'Acme\u202eCorp'],
      ['byte order mark', 'Acme\ufeffCorp'],
      ['lone surrogate', 'Acme\ud800Corp'],
      ['tag character', `Acme${String.fromCodePoint(0xe0041)}Corp`],
      ['noncharacter', 'Acme\ufffeCorp'],
      ['private use character', 'Acme\ue000Corp'],
      ['Hangul filler', 'Acme\u3164Corp'],
      ['braille blank', 'Acme\u2800Corp'],
      ['combining grapheme joiner', 'Acme\u034fCorp'],
    ])('rejects names containing a %s', (_label, value) => {
      expect(ZNameSchema.safeParse(value)).toMatchObject({
        success: false,
        error: {
          issues: expect.arrayContaining([expect.objectContaining({ message: 'Name contains invalid characters.' })]),
        },
      });
    });

    it.each([
      ['fixed form', String.raw`Acme\u200bCorp`],
      ['uppercase U', String.raw`Acme\U200BCorp`],
      ['braced form', String.raw`Acme\u{200b}Corp`],
      ['braced form with leading zeros', String.raw`Acme\u{0000200b}Corp`],
      ['lone surrogate', String.raw`Acme\ud800Corp`],
    ])('rejects literal \\u escape sequences stored as text (%s)', (_label, value) => {
      expect(ZNameSchema.safeParse(value)).toMatchObject({
        success: false,
        error: {
          issues: expect.arrayContaining([expect.objectContaining({ message: 'Name contains invalid characters.' })]),
        },
      });
    });

    it.each([
      ['escape of a valid code point', String.raw`Acme\u0041Corp`],
      ['braced escape of a valid astral code point', String.raw`Acme\u{1F600}Corp`],
      ['braced escape beyond the Unicode range', String.raw`Acme\u{FFFFFFF}Corp`],
      ['incomplete escape sequence', String.raw`Acme\u00 Corp`],
      ['unterminated braced escape', String.raw`Acme\u{200bCorp`],
      ['astral characters such as emoji', 'Acme 😀 Corp'],
      ['emoji with a variation selector', 'I ❤️ Docs'],
    ])('accepts %s', (_label, value) => {
      expect(ZNameSchema.safeParse(value)).toMatchObject({
        success: true,
      });
    });
  });
});
