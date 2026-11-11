import { Settings } from 'luxon';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_DOCUMENT_DATE_FORMAT,
  VALID_DATE_FORMAT_VALUES,
  convertToLocalSystemFormat,
  isDateOnlyFormat,
} from './date-formats';

describe('date-formats (#3463)', () => {
  const originalZone = Settings.defaultZone;

  afterEach(() => {
    Settings.defaultZone = originalZone;
  });

  it('correctly classifies date-only vs time-containing formats', () => {
    expect(isDateOnlyFormat('MM/dd/yyyy')).toBe(true);
    expect(isDateOnlyFormat('yyyy-MM-dd')).toBe(true);
    expect(isDateOnlyFormat('dd/MM/yyyy')).toBe(true);
    expect(isDateOnlyFormat('MMMM dd, yyyy')).toBe(true);
    expect(isDateOnlyFormat('EEEE, MMMM dd, yyyy')).toBe(true);
    expect(isDateOnlyFormat(DEFAULT_DOCUMENT_DATE_FORMAT)).toBe(false);
    expect(isDateOnlyFormat('yyyy-MM-dd HH:mm')).toBe(false);
    expect(isDateOnlyFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX")).toBe(false);
  });

  it('preserves calendar day for date-only formats when viewer timezone is west of document timezone', () => {
    Settings.defaultZone = 'America/New_York';

    expect(convertToLocalSystemFormat('10/20/2026', 'MM/dd/yyyy', 'Etc/UTC')).toBe('10/20/2026');
    expect(convertToLocalSystemFormat('2026-10-20', 'yyyy-MM-dd', 'Asia/Tokyo')).toBe('2026-10-20');
    expect(convertToLocalSystemFormat('20/10/2026', 'dd/MM/yyyy', 'Europe/London')).toBe('20/10/2026');
  });

  it('still converts datetime formats with time components to viewer local timezone', () => {
    Settings.defaultZone = 'America/New_York';

    const converted = convertToLocalSystemFormat(
      '2026-10-20 02:30',
      'yyyy-MM-dd HH:mm',
      'Etc/UTC',
    );
    expect(converted).toBe('2026-10-19 22:30');
  });
});
