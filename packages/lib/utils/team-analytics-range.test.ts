import { describe, expect, it } from 'vitest';

import { AppErrorCode } from '../errors/app-error';
import { resolveTeamAnalyticsRange } from './team-analytics-range';

const invalidRequest = expect.objectContaining({ code: AppErrorCode.INVALID_REQUEST });

describe('resolveTeamAnalyticsRange', () => {
  describe('presets', () => {
    it('ends at the start of tomorrow so today is included', () => {
      const resolved = resolveTeamAnalyticsRange({
        range: '7d',
        timezone: 'UTC',
        now: new Date('2025-01-15T12:34:56.000Z'),
      });

      expect(resolved).toEqual({
        range: '7d',
        from: '2025-01-09',
        to: '2025-01-15',
        timezone: 'UTC',
        start: new Date('2025-01-09T00:00:00.000Z'),
        end: new Date('2025-01-16T00:00:00.000Z'),
        previousStart: new Date('2025-01-02T00:00:00.000Z'),
        previousEnd: new Date('2025-01-09T00:00:00.000Z'),
        bucket: 'day',
      });
    });

    it('keeps boundaries on local midnight across the March DST change in America/New_York', () => {
      // DST began on 2024-03-10 in New York (EST -05:00 -> EDT -04:00).
      const resolved = resolveTeamAnalyticsRange({
        range: '7d',
        timezone: 'America/New_York',
        now: new Date('2024-03-12T18:00:00.000Z'),
      });

      // 2024-03-13T00:00 EDT
      expect(resolved.end).toEqual(new Date('2024-03-13T04:00:00.000Z'));
      // 2024-03-06T00:00 EST (before the change), still local midnight.
      expect(resolved.start).toEqual(new Date('2024-03-06T05:00:00.000Z'));
      // 2024-02-28T00:00 EST
      expect(resolved.previousStart).toEqual(new Date('2024-02-28T05:00:00.000Z'));
    });

    it('resolves 30d and 90d as calendar-day windows', () => {
      const now = new Date('2025-06-30T23:59:59.000Z');

      const thirty = resolveTeamAnalyticsRange({ range: '30d', timezone: 'UTC', now });

      expect(thirty.end).toEqual(new Date('2025-07-01T00:00:00.000Z'));
      expect(thirty.start).toEqual(new Date('2025-06-01T00:00:00.000Z'));
      expect(thirty.previousStart).toEqual(new Date('2025-05-02T00:00:00.000Z'));
      expect(thirty.previousEnd).toEqual(thirty.start);
      expect(thirty.from).toBe('2025-06-01');
      expect(thirty.to).toBe('2025-06-30');

      const ninety = resolveTeamAnalyticsRange({ range: '90d', timezone: 'UTC', now });

      expect(ninety.end).toEqual(new Date('2025-07-01T00:00:00.000Z'));
      expect(ninety.start).toEqual(new Date('2025-04-02T00:00:00.000Z'));
      expect(ninety.previousStart).toEqual(new Date('2025-01-02T00:00:00.000Z'));
      expect(ninety.from).toBe('2025-04-02');
      expect(ninety.to).toBe('2025-06-30');
    });

    it('aligns 12m to the start of the month 11 months ago with monthly buckets', () => {
      const resolved = resolveTeamAnalyticsRange({
        range: '12m',
        timezone: 'UTC',
        now: new Date('2025-03-20T10:00:00.000Z'),
      });

      expect(resolved).toEqual({
        range: '12m',
        from: '2024-04-01',
        to: '2025-03-20',
        timezone: 'UTC',
        start: new Date('2024-04-01T00:00:00.000Z'),
        end: new Date('2025-03-21T00:00:00.000Z'),
        previousStart: new Date('2023-04-01T00:00:00.000Z'),
        previousEnd: new Date('2024-04-01T00:00:00.000Z'),
        bucket: 'month',
      });
    });

    it('aligns 12m month boundaries to the request timezone', () => {
      // 2025-01-01T03:00Z is still 2024-12-31 in Los Angeles.
      const resolved = resolveTeamAnalyticsRange({
        range: '12m',
        timezone: 'America/Los_Angeles',
        now: new Date('2025-01-01T03:00:00.000Z'),
      });

      // 2024-01-01T00:00 PST
      expect(resolved.start).toEqual(new Date('2024-01-01T08:00:00.000Z'));
      // 2025-01-01T00:00 PST
      expect(resolved.end).toEqual(new Date('2025-01-01T08:00:00.000Z'));
      // 2023-01-01T00:00 PST
      expect(resolved.previousStart).toEqual(new Date('2023-01-01T08:00:00.000Z'));
      expect(resolved.from).toBe('2024-01-01');
      expect(resolved.to).toBe('2024-12-31');
    });

    it('ignores from/to for presets', () => {
      const resolved = resolveTeamAnalyticsRange({
        range: '7d',
        from: '2020-01-01',
        to: '2020-01-02',
        timezone: 'UTC',
        now: new Date('2025-01-15T12:34:56.000Z'),
      });

      expect(resolved.from).toBe('2025-01-09');
      expect(resolved.to).toBe('2025-01-15');
    });

    it('rejects invalid timezones', () => {
      expect(() =>
        resolveTeamAnalyticsRange({
          range: '30d',
          timezone: 'Not/A_Zone',
          now: new Date('2025-01-15T12:00:00.000Z'),
        }),
      ).toThrow(invalidRequest);
    });
  });

  describe('custom', () => {
    const now = new Date('2025-01-15T12:00:00.000Z');

    it('resolves an inclusive calendar window with an equally sized previous window', () => {
      const resolved = resolveTeamAnalyticsRange({
        range: 'custom',
        from: '2024-02-01',
        to: '2024-02-29',
        timezone: 'UTC',
        now,
      });

      // 29 days (leap February), previous window is the 29 days ending Jan 31.
      expect(resolved).toEqual({
        range: 'custom',
        from: '2024-02-01',
        to: '2024-02-29',
        timezone: 'UTC',
        start: new Date('2024-02-01T00:00:00.000Z'),
        end: new Date('2024-03-01T00:00:00.000Z'),
        previousStart: new Date('2024-01-03T00:00:00.000Z'),
        previousEnd: new Date('2024-02-01T00:00:00.000Z'),
        bucket: 'day',
      });
    });

    it('uses day buckets up to 92 days and month buckets beyond', () => {
      // Apr 1 .. Jul 1 2024 inclusive is 92 days.
      const ninetyTwo = resolveTeamAnalyticsRange({
        range: 'custom',
        from: '2024-04-01',
        to: '2024-07-01',
        timezone: 'UTC',
        now,
      });

      expect(ninetyTwo.bucket).toBe('day');

      const ninetyThree = resolveTeamAnalyticsRange({
        range: 'custom',
        from: '2024-04-01',
        to: '2024-07-02',
        timezone: 'UTC',
        now,
      });

      expect(ninetyThree.bucket).toBe('month');
      expect(ninetyThree.start).toEqual(new Date('2024-04-01T00:00:00.000Z'));
      expect(ninetyThree.end).toEqual(new Date('2024-07-03T00:00:00.000Z'));
      expect(ninetyThree.previousStart).toEqual(new Date('2023-12-30T00:00:00.000Z'));
    });

    it('allows a single-day range and a range ending today', () => {
      const resolved = resolveTeamAnalyticsRange({
        range: 'custom',
        from: '2025-01-15',
        to: '2025-01-15',
        timezone: 'UTC',
        now,
      });

      expect(resolved.start).toEqual(new Date('2025-01-15T00:00:00.000Z'));
      expect(resolved.end).toEqual(new Date('2025-01-16T00:00:00.000Z'));
      expect(resolved.previousStart).toEqual(new Date('2025-01-14T00:00:00.000Z'));
    });

    it('keeps local midnight bounds across the March DST change in America/New_York', () => {
      // DST began on 2024-03-10 in New York (EST -05:00 -> EDT -04:00).
      const resolved = resolveTeamAnalyticsRange({
        range: 'custom',
        from: '2024-03-06',
        to: '2024-03-12',
        timezone: 'America/New_York',
        now,
      });

      // 2024-03-06T00:00 EST
      expect(resolved.start).toEqual(new Date('2024-03-06T05:00:00.000Z'));
      // 2024-03-13T00:00 EDT
      expect(resolved.end).toEqual(new Date('2024-03-13T04:00:00.000Z'));
      // 7 calendar days, not 7 * 24h: 2024-02-28T00:00 EST
      expect(resolved.previousStart).toEqual(new Date('2024-02-28T05:00:00.000Z'));
      expect(resolved.from).toBe('2024-03-06');
      expect(resolved.to).toBe('2024-03-12');
      expect(resolved.bucket).toBe('day');
    });

    it('evaluates "today" in the request timezone', () => {
      // 2025-01-15T03:00Z is still 2025-01-14 in Los Angeles, so 2025-01-15 is in the future there.
      const lateNow = new Date('2025-01-15T03:00:00.000Z');

      expect(() =>
        resolveTeamAnalyticsRange({
          range: 'custom',
          from: '2025-01-10',
          to: '2025-01-15',
          timezone: 'America/Los_Angeles',
          now: lateNow,
        }),
      ).toThrow(invalidRequest);

      expect(() =>
        resolveTeamAnalyticsRange({
          range: 'custom',
          from: '2025-01-10',
          to: '2025-01-15',
          timezone: 'UTC',
          now: lateNow,
        }),
      ).not.toThrow();
    });

    it('rejects from after to', () => {
      expect(() =>
        resolveTeamAnalyticsRange({
          range: 'custom',
          from: '2024-02-10',
          to: '2024-02-01',
          timezone: 'UTC',
          now,
        }),
      ).toThrow(invalidRequest);
    });

    it('rejects a missing bound', () => {
      expect(() =>
        resolveTeamAnalyticsRange({
          range: 'custom',
          from: '2024-02-01',
          timezone: 'UTC',
          now,
        }),
      ).toThrow(invalidRequest);

      expect(() =>
        resolveTeamAnalyticsRange({
          range: 'custom',
          to: '2024-02-01',
          timezone: 'UTC',
          now,
        }),
      ).toThrow(invalidRequest);
    });

    it('rejects a to in the future', () => {
      expect(() =>
        resolveTeamAnalyticsRange({
          range: 'custom',
          from: '2025-01-01',
          to: '2025-01-16',
          timezone: 'UTC',
          now,
        }),
      ).toThrow(invalidRequest);
    });

    it('rejects ranges starting more than a year and a day ago', () => {
      // now is 2025-01-15, so the earliest allowed start is 2024-01-14.
      expect(() =>
        resolveTeamAnalyticsRange({
          range: 'custom',
          from: '2024-01-13',
          to: '2024-03-10',
          timezone: 'UTC',
          now,
        }),
      ).toThrow(invalidRequest);

      // Exactly a year and a day ago is allowed, up to today.
      expect(() =>
        resolveTeamAnalyticsRange({
          range: 'custom',
          from: '2024-01-14',
          to: '2025-01-15',
          timezone: 'UTC',
          now,
        }),
      ).not.toThrow();
    });

    it('rejects malformed or non-existent dates', () => {
      for (const to of ['2024-02-30', '2024-13-01', '2024-02-1', '2024-02-01T00:00:00Z', 'yesterday']) {
        expect(() =>
          resolveTeamAnalyticsRange({
            range: 'custom',
            from: '2024-06-01',
            to,
            timezone: 'UTC',
            now,
          }),
        ).toThrow(invalidRequest);
      }
    });
  });
});
