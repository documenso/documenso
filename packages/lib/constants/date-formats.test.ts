import { Settings } from 'luxon';
import { afterEach, describe, expect, it } from 'vitest';

import { convertToLocalSystemFormat, isDateOnlyFormat } from './date-formats';

describe('isDateOnlyFormat', () => {
  it('identifies date-only formats without time tokens', () => {
    expect(isDateOnlyFormat('yyyy-MM-dd')).toBe(true);
    expect(isDateOnlyFormat('dd/MM/yyyy')).toBe(true);
    expect(isDateOnlyFormat('dd-MM-yyyy')).toBe(true);
    expect(isDateOnlyFormat('MM/dd/yyyy')).toBe(true);
    expect(isDateOnlyFormat('yy-MM-dd')).toBe(true);
    expect(isDateOnlyFormat('MMMM dd, yyyy')).toBe(true);
    expect(isDateOnlyFormat('EEEE, MMMM dd, yyyy')).toBe(true);
    expect(isDateOnlyFormat('dd.MM.yyyy')).toBe(true);
  });

  it('identifies formats with hour/minute/second tokens as non-date-only', () => {
    expect(isDateOnlyFormat('yyyy-MM-dd hh:mm a')).toBe(false);
    expect(isDateOnlyFormat('yyyy-MM-dd HH:mm')).toBe(false);
    expect(isDateOnlyFormat('dd/MM/yyyy HH:mm')).toBe(false);
    expect(isDateOnlyFormat('dd/MM/yyyy hh:mm a')).toBe(false);
    expect(isDateOnlyFormat('dd.MM.yyyy HH:mm')).toBe(false);
    expect(isDateOnlyFormat('yyyy-MM-dd HH:mm:ss')).toBe(false);
    expect(isDateOnlyFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX")).toBe(false);
  });
});

describe('convertToLocalSystemFormat', () => {
  const defaultZone = Settings.defaultZone;

  afterEach(() => {
    Settings.defaultZone = defaultZone;
  });

  it('preserves the calendar date for viewers west of the document timezone on date-only formats', () => {
    Settings.defaultZone = 'America/New_York';

    expect(convertToLocalSystemFormat('2026-10-20', 'yyyy-MM-dd', 'Etc/UTC')).toBe('2026-10-20');
    expect(convertToLocalSystemFormat('10/20/2026', 'MM/dd/yyyy', 'Etc/UTC')).toBe('10/20/2026');
    expect(convertToLocalSystemFormat('20/10/2026', 'dd/MM/yyyy', 'Europe/Berlin')).toBe(
      '20/10/2026',
    );
  });

  it('converts timestamps with time components to the viewer local timezone', () => {
    Settings.defaultZone = 'America/New_York';

    expect(convertToLocalSystemFormat('2026-01-20 15:30', 'yyyy-MM-dd HH:mm', 'Etc/UTC')).toBe(
      '2026-01-20 10:30',
    );
  });

  it('returns Invalid date for malformed inputs', () => {
    expect(convertToLocalSystemFormat('not-a-date', 'yyyy-MM-dd')).toBe('Invalid date');
  });
});
