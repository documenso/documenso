import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { convertToLocalSystemFormat, toLuxonDateFormat } from './date-formats';

const ISO_8601_DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX";

describe('toLuxonDateFormat', () => {
  it('maps the stored ISO 8601 format to a luxon format that renders the offset', () => {
    const date = DateTime.fromISO('2026-03-05T10:20:30.123', { zone: 'Asia/Kolkata' });

    expect(date.toFormat(toLuxonDateFormat(ISO_8601_DATE_FORMAT))).toBe('2026-03-05T10:20:30.123+05:30');
  });

  it('returns other formats unchanged', () => {
    expect(toLuxonDateFormat('dd/MM/yyyy HH:mm')).toBe('dd/MM/yyyy HH:mm');
  });

  it('falls back to the default format', () => {
    expect(toLuxonDateFormat(null)).toBe('yyyy-MM-dd hh:mm a');
    expect(toLuxonDateFormat(undefined)).toBe('yyyy-MM-dd hh:mm a');
  });
});

describe('convertToLocalSystemFormat', () => {
  it('parses dates stamped with the ISO 8601 format', () => {
    expect(convertToLocalSystemFormat('2026-03-05T10:20:30.123+05:30', ISO_8601_DATE_FORMAT, 'Asia/Kolkata')).not.toBe(
      'Invalid date',
    );
  });

  it('still parses dates stamped before the fix with a literal "XXX" suffix', () => {
    expect(convertToLocalSystemFormat('2026-03-05T10:20:30.123XXX', ISO_8601_DATE_FORMAT, 'Asia/Kolkata')).not.toBe(
      'Invalid date',
    );
  });
});
