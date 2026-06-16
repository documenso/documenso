// ABOUTME: Unit tests for the parsePrefillDate helper.
// Verifies locale-independent date parsing from bulk-send CSV input.
import { describe, expect, it } from 'vitest';

import { parsePrefillDate } from './parse-prefill-date';

describe('parsePrefillDate', () => {
  it('parses ISO date (2026-06-07) as June 7 2026', () => {
    const result = parsePrefillDate('2026-06-07');
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2026);
    expect(result!.month).toBe(6);
    expect(result!.day).toBe(7);
  });

  it('parses M/d/yyyy (6/7/2026) as June 7 NOT July 6', () => {
    const result = parsePrefillDate('6/7/2026');
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2026);
    expect(result!.month).toBe(6);
    expect(result!.day).toBe(7);
  });

  it('parses MM/dd/yyyy (06/07/2026) as June 7 2026', () => {
    const result = parsePrefillDate('06/07/2026');
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2026);
    expect(result!.month).toBe(6);
    expect(result!.day).toBe(7);
  });

  it('returns null for an invalid string', () => {
    expect(parsePrefillDate('not-a-date')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parsePrefillDate('')).toBeNull();
  });
});
