import { describe, expect, it } from 'vitest';

import { AppErrorCode } from '../errors/app-error';
import { resolveAnalyticsPeriod } from './analytics-period';

describe('resolveAnalyticsPeriod', () => {
  it('uses local midnight across daylight-saving changes', () => {
    const period = resolveAnalyticsPeriod({
      period: 'day',
      date: '2024-03-10',
      timezone: 'America/New_York',
      now: new Date('2024-03-10T18:00:00.000Z'),
    });

    expect(period).toEqual({
      unit: 'day',
      date: '2024-03-10',
      timezone: 'America/New_York',
      start: new Date('2024-03-10T05:00:00.000Z'),
      end: new Date('2024-03-11T04:00:00.000Z'),
    });
  });

  it('starts weeks on Monday across year boundaries', () => {
    const period = resolveAnalyticsPeriod({
      period: 'week',
      date: '2025-01-01',
      timezone: 'UTC',
      now: new Date('2025-01-02T12:00:00.000Z'),
    });

    expect(period.date).toBe('2024-12-30');
    expect(period.start).toEqual(new Date('2024-12-30T00:00:00.000Z'));
    expect(period.end).toEqual(new Date('2025-01-06T00:00:00.000Z'));
  });

  it('normalizes a selected date to its containing leap-month boundary', () => {
    const period = resolveAnalyticsPeriod({
      period: 'month',
      date: '2024-02-29',
      timezone: 'UTC',
      now: new Date('2024-03-01T00:00:00.000Z'),
    });

    expect(period.date).toBe('2024-02-01');
    expect(period.start).toEqual(new Date('2024-02-01T00:00:00.000Z'));
    expect(period.end).toEqual(new Date('2024-03-01T00:00:00.000Z'));
  });

  it('rejects invalid zones, calendar dates, and future-only periods', () => {
    const now = new Date('2025-01-15T12:00:00.000Z');

    for (const input of [
      { period: 'day' as const, date: '2025-02-30', timezone: 'UTC', now },
      { period: 'day' as const, date: '2025-01-15', timezone: 'Not/A_Zone', now },
      { period: 'month' as const, date: '2025-02-01', timezone: 'UTC', now },
    ]) {
      expect(() => resolveAnalyticsPeriod(input)).toThrow(
        expect.objectContaining({ code: AppErrorCode.INVALID_REQUEST }),
      );
    }
  });
});
