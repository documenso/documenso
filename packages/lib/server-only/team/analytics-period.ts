import { DateTime } from 'luxon';
import { match } from 'ts-pattern';
import { z } from 'zod';

/**
 * Calendar period presets for the team analytics dashboard. Each resolves to a
 * half-open `[start, end)` instant range in the viewer's timezone.
 *
 * Pure (zod + luxon, no Prisma) so it can be unit-tested without a database and
 * shared with the request schema without pulling server-only code anywhere it
 * should not go.
 */
export const ZAnalyticsPeriodSchema = z.enum([
  'week',
  'month',
  'quarter',
  'year',
  'lastMonth',
  'last7Days',
  'last30Days',
]);

export type AnalyticsPeriod = z.infer<typeof ZAnalyticsPeriodSchema>;

export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = 'month';

export type AnalyticsPeriodRange = {
  start: Date;
  end: Date;
};

/**
 * Resolve a calendar preset into a half-open `[start, end)` instant range,
 * anchored to the viewer's timezone.
 *
 * Falls back to UTC when the zone is missing or invalid so boundaries never
 * silently drift to the server's local zone.
 */
export const resolveAnalyticsPeriod = ({
  period,
  timezone,
}: {
  period: AnalyticsPeriod;
  timezone?: string;
}): AnalyticsPeriodRange => {
  const zoned = DateTime.now().setZone(timezone ?? 'utc');
  const now = zoned.isValid ? zoned : DateTime.now().setZone('utc');

  const { start, end } = match(period)
    .with('week', () => ({
      start: now.startOf('week'),
      end: now.startOf('week').plus({ weeks: 1 }),
    }))
    .with('month', () => ({
      start: now.startOf('month'),
      end: now.startOf('month').plus({ months: 1 }),
    }))
    .with('quarter', () => ({
      start: now.startOf('quarter'),
      end: now.startOf('quarter').plus({ quarters: 1 }),
    }))
    .with('year', () => ({
      start: now.startOf('year'),
      end: now.startOf('year').plus({ years: 1 }),
    }))
    .with('lastMonth', () => ({
      start: now.startOf('month').minus({ months: 1 }),
      end: now.startOf('month'),
    }))
    .with('last7Days', () => ({
      start: now.startOf('day').minus({ days: 6 }),
      end: now.startOf('day').plus({ days: 1 }),
    }))
    .with('last30Days', () => ({
      start: now.startOf('day').minus({ days: 29 }),
      end: now.startOf('day').plus({ days: 1 }),
    }))
    .exhaustive();

  return {
    start: start.toJSDate(),
    end: end.toJSDate(),
  };
};
