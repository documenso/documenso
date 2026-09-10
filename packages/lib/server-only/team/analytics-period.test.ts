import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveAnalyticsPeriod } from './analytics-period';

const iso = (date: Date) => date.toISOString();

describe('resolveAnalyticsPeriod', () => {
  // Friday, 2026-05-15. May 2026 is EDT (UTC-4) in the US.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves "month" to the current calendar month, half-open, in UTC by default', () => {
    const { start, end } = resolveAnalyticsPeriod({ period: 'month' });

    expect(iso(start)).toBe('2026-05-01T00:00:00.000Z');
    expect(iso(end)).toBe('2026-06-01T00:00:00.000Z');
  });

  it('anchors month boundaries to the viewer timezone', () => {
    const { start, end } = resolveAnalyticsPeriod({ period: 'month', timezone: 'America/New_York' });

    // Local midnight in EDT is 04:00 UTC.
    expect(iso(start)).toBe('2026-05-01T04:00:00.000Z');
    expect(iso(end)).toBe('2026-06-01T04:00:00.000Z');
  });

  it('shifts the window for a zone ahead of UTC', () => {
    const { start, end } = resolveAnalyticsPeriod({ period: 'month', timezone: 'Asia/Tokyo' });

    // JST is UTC+9, so local midnight is the previous day at 15:00 UTC.
    expect(iso(start)).toBe('2026-04-30T15:00:00.000Z');
    expect(iso(end)).toBe('2026-05-31T15:00:00.000Z');
  });

  it('falls back to UTC for an invalid timezone', () => {
    const { start, end } = resolveAnalyticsPeriod({ period: 'month', timezone: 'Not/AZone' });

    expect(iso(start)).toBe('2026-05-01T00:00:00.000Z');
    expect(iso(end)).toBe('2026-06-01T00:00:00.000Z');
  });

  it('resolves "lastMonth" contiguous with the start of the current month', () => {
    const lastMonth = resolveAnalyticsPeriod({ period: 'lastMonth' });
    const thisMonth = resolveAnalyticsPeriod({ period: 'month' });

    expect(iso(lastMonth.start)).toBe('2026-04-01T00:00:00.000Z');
    expect(iso(lastMonth.end)).toBe('2026-05-01T00:00:00.000Z');
    expect(iso(lastMonth.end)).toBe(iso(thisMonth.start));
  });

  it('resolves "quarter" to the current calendar quarter', () => {
    const { start, end } = resolveAnalyticsPeriod({ period: 'quarter' });

    expect(iso(start)).toBe('2026-04-01T00:00:00.000Z');
    expect(iso(end)).toBe('2026-07-01T00:00:00.000Z');
  });

  it('resolves "year" to the current calendar year', () => {
    const { start, end } = resolveAnalyticsPeriod({ period: 'year' });

    expect(iso(start)).toBe('2026-01-01T00:00:00.000Z');
    expect(iso(end)).toBe('2027-01-01T00:00:00.000Z');
  });

  it('resolves "last30Days" as a trailing 30-day window including today', () => {
    const { start, end } = resolveAnalyticsPeriod({ period: 'last30Days' });

    expect(iso(start)).toBe('2026-04-16T00:00:00.000Z');
    expect(iso(end)).toBe('2026-05-16T00:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('resolves "last7Days" as a trailing 7-day window including today', () => {
    const { start, end } = resolveAnalyticsPeriod({ period: 'last7Days' });

    expect(iso(start)).toBe('2026-05-09T00:00:00.000Z');
    expect(iso(end)).toBe('2026-05-16T00:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('resolves "week" to a 7-day ISO week starting Monday', () => {
    const { start, end } = resolveAnalyticsPeriod({ period: 'week' });

    // 2026-05-15 is a Friday; the ISO week starts Monday 2026-05-11.
    expect(iso(start)).toBe('2026-05-11T00:00:00.000Z');
    expect(iso(end)).toBe('2026-05-18T00:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
