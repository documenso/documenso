import { describe, expect, it } from 'vitest';

import { convertToLocalSystemFormat, isDateOnlyFormat } from './date-formats';

describe('date-formats', () => {
  describe('isDateOnlyFormat', () => {
    it('should return true for date-only formats', () => {
      expect(isDateOnlyFormat('yyyy-MM-dd')).toBe(true);
      expect(isDateOnlyFormat('MM/dd/yyyy')).toBe(true);
      expect(isDateOnlyFormat('dd/MM/yyyy')).toBe(true);
      expect(isDateOnlyFormat('dd-MM-yyyy')).toBe(true);
      expect(isDateOnlyFormat('MMMM dd, yyyy')).toBe(true);
      expect(isDateOnlyFormat('EEEE, MMMM dd, yyyy')).toBe(true);
      expect(isDateOnlyFormat('dd.MM.yyyy')).toBe(true);
    });

    it('should return false for formats with time components', () => {
      expect(isDateOnlyFormat('yyyy-MM-dd hh:mm a')).toBe(false);
      expect(isDateOnlyFormat('yyyy-MM-dd HH:mm')).toBe(false);
      expect(isDateOnlyFormat('dd/MM/yyyy HH:mm')).toBe(false);
      expect(isDateOnlyFormat('yyyy-MM-dd HH:mm:ss')).toBe(false);
    });
  });

  describe('convertToLocalSystemFormat', () => {
    it('should not shift date-only fields backward across timezones', () => {
      const result = convertToLocalSystemFormat('10/20/2026', 'MM/dd/yyyy', 'Etc/UTC');
      expect(result).toBe('10/20/2026');
    });

    it('should preserve date-only format in ISO yyyy-MM-dd', () => {
      const result = convertToLocalSystemFormat('2026-10-20', 'yyyy-MM-dd', 'Etc/UTC');
      expect(result).toBe('2026-10-20');
    });

    it('should return Invalid date for malformed input', () => {
      const result = convertToLocalSystemFormat('not-a-date', 'MM/dd/yyyy', 'Etc/UTC');
      expect(result).toBe('Invalid date');
    });
  });
});
