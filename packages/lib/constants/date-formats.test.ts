import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import {
  convertToLocalSystemFormat,
  DEFAULT_DOCUMENT_DATE_FORMAT,
  toLuxonDateFormat,
} from './date-formats';

describe('Documenso Issue #3453 - ISO 8601 Date Format Luxon Translation', () => {
  it('translates date-fns XXX timezone token to Luxon ZZ token', () => {
    const rawFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX";
    const mapped = toLuxonDateFormat(rawFormat);

    expect(mapped).toBe("yyyy-MM-dd'T'HH:mm:ss.SSSZZ");
  });

  it('eliminates literal XXX timestamp stamps when formatting', () => {
    const dt = DateTime.fromISO('2026-03-05T10:20:30.123', { zone: 'UTC' });
    const luxonFormat = toLuxonDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
    const output = dt.toFormat(luxonFormat);

    expect(output).not.toContain('XXX');
    expect(output).toBe('2026-03-05T10:20:30.123+00:00');
  });

  it('correctly renders custom timezone offsets (+05:30)', () => {
    const dt = DateTime.fromISO('2026-03-05T10:20:30.123', { zone: 'Asia/Kolkata' });
    const luxonFormat = toLuxonDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
    const output = dt.toFormat(luxonFormat);

    expect(output).toBe('2026-03-05T10:20:30.123+05:30');
  });

  it('recovers legacy corrupted dates ending in literal XXX suffix', () => {
    const legacyCorruptedString = '2026-03-05T10:20:30.123XXX';
    const result = convertToLocalSystemFormat(
      legacyCorruptedString,
      "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
      'UTC'
    );

    expect(result).not.toBe('Invalid date');
    expect(result).not.toContain('XXX');
  });

  it('preserves non-ISO format strings unchanged', () => {
    expect(toLuxonDateFormat('yyyy-MM-dd')).toBe('yyyy-MM-dd');
    expect(toLuxonDateFormat('dd/MM/yyyy')).toBe('dd/MM/yyyy');
  });
});
