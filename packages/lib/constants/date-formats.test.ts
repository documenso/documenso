import { describe, expect, it } from 'vitest';

import { convertToLocalSystemFormat, isDateOnlyFormat } from './date-formats';

describe('isDateOnlyFormat', () => {
  it('detects date-only formats accurately', () => {
    expect(isDateOnlyFormat('yyyy-MM-dd')).toBe(true);
    expect(isDateOnlyFormat('dd/MM/yyyy')).toBe(true);
    expect(isDateOnlyFormat('dd-MM-yyyy')).toBe(true);
    expect(isDateOnlyFormat('MM/dd/yyyy')).toBe(true);
    expect(isDateOnlyFormat('yy-MM-dd')).toBe(true);
    expect(isDateOnlyFormat('MMMM dd, yyyy')).toBe(true);
    expect(isDateOnlyFormat('EEEE, MMMM dd, yyyy')).toBe(true);
    expect(isDateOnlyFormat('dd.MM.yyyy')).toBe(true);
  });

  it('detects formats containing time components as not date-only', () => {
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
  it('preserves calendar date for date-only formats without shifting across timezones', () => {
    const inputDate = '10/20/2026';
    const formatted = convertToLocalSystemFormat(inputDate, 'MM/dd/yyyy', 'Etc/UTC');
    expect(formatted).toBe('10/20/2026');
  });

  it('preserves yyyy-MM-dd calendar date without timezone shift', () => {
    const inputDate = '2026-10-20';
    const formatted = convertToLocalSystemFormat(inputDate, 'yyyy-MM-dd', 'Etc/UTC');
    expect(formatted).toBe('2026-10-20');
  });

  it('returns Invalid date for malformed dates', () => {
    const formatted = convertToLocalSystemFormat('not-a-date', 'yyyy-MM-dd');
    expect(formatted).toBe('Invalid date');
  });
});
