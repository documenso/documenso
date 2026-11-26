import { describe, expect, it } from 'vitest';

import { convertToLocalSystemFormat, toLuxonDateFormat } from './date-formats';

describe('date formats', () => {
  it('converts the persisted ISO 8601 format to the Luxon equivalent', () => {
    expect(toLuxonDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX")).toBe("yyyy-MM-dd'T'HH:mm:ss.SSSZZ");
  });

  it('formats ISO 8601 dates with the timezone offset', () => {
    expect(
      convertToLocalSystemFormat({
        customText: '2026-03-05T10:20:30.123+05:30',
        dateFormat: "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
        timezone: 'Asia/Kolkata',
      }),
    ).toBe('2026-03-05T04:50:30.123+00:00');
  });

  it('parses dates stamped with the legacy literal XXX', () => {
    expect(
      convertToLocalSystemFormat({
        customText: '2026-03-05T10:20:30.123XXX',
        dateFormat: "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
        timezone: 'Asia/Kolkata',
      }),
    ).toBe('2026-03-05T04:50:30.123+00:00');
  });
});
