import { describe, expect, it } from 'vitest';

import { convertToLocalSystemFormat, toLuxonDateFormat } from './date-formats';

describe('toLuxonDateFormat', () => {
  it('maps the ISO 8601 XXX offset token to the luxon ZZ token', () => {
    expect(toLuxonDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX")).toBe("yyyy-MM-dd'T'HH:mm:ss.SSSZZ");
  });

  it('leaves other formats untouched', () => {
    expect(toLuxonDateFormat('yyyy-MM-dd HH:mm')).toBe('yyyy-MM-dd HH:mm');
    expect(toLuxonDateFormat('yyyy-MM-dd')).toBe('yyyy-MM-dd');
  });
});

describe('convertToLocalSystemFormat', () => {
  it('parses ISO 8601 stamps rendered with the luxon offset', () => {
    const result = convertToLocalSystemFormat(
      '2026-03-05T10:20:30.123+05:30',
      "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
      'Asia/Kolkata',
    );

    expect(result).not.toBe('Invalid date');
  });

  it('parses legacy stamps that were written with the literal XXX token', () => {
    const result = convertToLocalSystemFormat(
      '2026-03-05T10:20:30.123XXX',
      "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
      'Asia/Kolkata',
    );

    expect(result).not.toBe('Invalid date');
  });
});
