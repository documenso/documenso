import { Settings } from 'luxon';
import { afterEach, describe, expect, it } from 'vitest';

import { convertToLocalSystemFormat } from './date-formats';

describe('convertToLocalSystemFormat', () => {
  afterEach(() => {
    Settings.defaultZone = 'system';
  });

  it('keeps a date-only value on its stored calendar day for a viewer west of the document zone', () => {
    Settings.defaultZone = 'America/Chicago';

    expect(convertToLocalSystemFormat('10/19/2026', 'MM/dd/yyyy', 'Etc/UTC')).toBe('10/19/2026');
  });

  it('keeps the weekday of a date-only value on its stored calendar day', () => {
    Settings.defaultZone = 'America/New_York';

    expect(convertToLocalSystemFormat('Monday, October 19, 2026', 'EEEE, MMMM dd, yyyy', 'Etc/UTC')).toBe(
      'Monday, October 19, 2026',
    );
  });

  it('still converts a date-time value into the viewer zone', () => {
    Settings.defaultZone = 'America/New_York';

    expect(convertToLocalSystemFormat('2026-10-20 00:30', 'yyyy-MM-dd HH:mm', 'Etc/UTC')).toBe(
      '2026-10-19 20:30',
    );
  });
});
