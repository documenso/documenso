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
    ])('rejects names containing a %s', (_label, value) => {
      expect(ZNameSchema.safeParse(value)).toMatchObject({
        success: false,
        error: {
          issues: expect.arrayContaining([expect.objectContaining({ message: 'Name contains invalid characters.' })]),
        },
      });
    });

    it('rejects literal \\u escape sequences stored as text', () => {
      expect(ZNameSchema.safeParse(String.raw`Acme\u200bCorp`)).toMatchObject({
        success: false,
        error: {
          issues: expect.arrayContaining([expect.objectContaining({ message: 'Name contains invalid characters.' })]),
        },
      });
    });
  });
});
