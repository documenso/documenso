import { Settings } from 'luxon';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_DOCUMENT_DATE_FORMAT,
  convertToLocalSystemFormat,
  isDateOnlyFormat,
} from './date-formats';

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
    expect(isDateOnlyFormat("yyyy-MM-dd 'at midnight'")).toBe(true);
  });

  it('identifies formats with hour, minute, second, or timestamp tokens as non-date-only', () => {
    expect(isDateOnlyFormat(DEFAULT_DOCUMENT_DATE_FORMAT)).toBe(false);
    expect(isDateOnlyFormat('yyyy-MM-dd HH:mm')).toBe(false);
    expect(isDateOnlyFormat('dd/MM/yyyy HH:mm')).toBe(false);
    expect(isDateOnlyFormat('dd/MM/yyyy hh:mm a')).toBe(false);
    expect(isDateOnlyFormat('dd.MM.yyyy HH:mm')).toBe(false);
    expect(isDateOnlyFormat('yyyy-MM-dd HH:mm:ss')).toBe(false);
    expect(isDateOnlyFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX")).toBe(false);
    expect(isDateOnlyFormat('yyyy-MM-dd mm:ss')).toBe(false);
  });
});

describe('convertToLocalSystemFormat', () => {
  const defaultZone = Settings.defaultZone;

  afterEach(() => {
    Settings.defaultZone = defaultZone;
  });

  it('preserves the calendar date for viewers west of the document timezone on date-only formats', () => {
    Settings.defaultZone = 'America/Chicago';

    expect(
      convertToLocalSystemFormat({
        customText: '10/20/2026',
        dateFormat: 'MM/dd/yyyy',
        timezone: 'Etc/UTC',
      }),
    ).toBe('10/20/2026');

    expect(
      convertToLocalSystemFormat({
        customText: '2026-10-20',
        dateFormat: 'yyyy-MM-dd',
        timezone: 'Etc/UTC',
      }),
    ).toBe('2026-10-20');

    expect(
      convertToLocalSystemFormat({
        customText: '20/10/2026',
        dateFormat: 'dd/MM/yyyy',
        timezone: 'Europe/Berlin',
      }),
    ).toBe('20/10/2026');
  });

  it('converts timestamps with time components to the viewer local timezone', () => {
    Settings.defaultZone = 'America/New_York';

    expect(
      convertToLocalSystemFormat({
        customText: '2026-01-20 15:30',
        dateFormat: 'yyyy-MM-dd HH:mm',
        timezone: 'Etc/UTC',
      }),
    ).toBe('2026-01-20 10:30');
  });

  it('returns Invalid date for malformed inputs', () => {
    expect(
      convertToLocalSystemFormat({
        customText: 'not-a-date',
        dateFormat: 'yyyy-MM-dd',
        timezone: 'Etc/UTC',
      }),
    ).toBe('Invalid date');
  });
});
