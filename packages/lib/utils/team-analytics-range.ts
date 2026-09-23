import type {
  TTeamAnalyticsRange,
  TTeamAnalyticsResolvedRange,
} from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { ANALYTICS_CUSTOM_RANGE_MAX_LOOKBACK } from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { DateTime, IANAZone } from 'luxon';

import { AppError, AppErrorCode } from '../errors/app-error';

const DAY_RANGE_LENGTHS: Record<Exclude<TTeamAnalyticsRange, '12m' | 'custom'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

/** Custom ranges longer than this many days are bucketed by month instead of by day. */
const CUSTOM_RANGE_MONTH_BUCKET_THRESHOLD_DAYS = 92;

const DATE_FORMAT = 'yyyy-MM-dd';

export type ResolveTeamAnalyticsRangeOptions = {
  range: TTeamAnalyticsRange;
  /** Inclusive start date (yyyy-MM-dd) in `timezone`; required when `range` is `custom`. */
  from?: string;
  /** Inclusive end date (yyyy-MM-dd) in `timezone`; required when `range` is `custom`. */
  to?: string;
  timezone: string;
  now?: Date;
};

/**
 * Resolve an analytics range into a half-open [start, end) window in the given IANA
 * timezone, plus the equally sized window immediately preceding it.
 *
 * For presets `end` is always the start of tomorrow in the timezone so that today is
 * included. For `custom` the window is [from, to] inclusive as calendar days.
 */
export const resolveTeamAnalyticsRange = ({
  range,
  from,
  to,
  timezone,
  now = new Date(),
}: ResolveTeamAnalyticsRangeOptions): TTeamAnalyticsResolvedRange => {
  if (!IANAZone.isValidZone(timezone)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid analytics timezone',
    });
  }

  const currentTime = DateTime.fromJSDate(now, { zone: timezone });

  if (!currentTime.isValid) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid analytics reference time',
    });
  }

  const today = currentTime.startOf('day');

  if (range === 'custom') {
    return resolveCustomRange({ from, to, timezone, today });
  }

  const end = today.plus({ days: 1 });

  if (range === '12m') {
    const start = today.startOf('month').minus({ months: 11 });

    return {
      range,
      from: start.toFormat(DATE_FORMAT),
      to: today.toFormat(DATE_FORMAT),
      timezone,
      start: start.toJSDate(),
      end: end.toJSDate(),
      previousStart: start.minus({ months: 12 }).toJSDate(),
      previousEnd: start.toJSDate(),
      bucket: 'month',
    };
  }

  const days = DAY_RANGE_LENGTHS[range];
  const start = end.minus({ days });
  const previousStart = start.minus({ days });

  return {
    range,
    from: start.toFormat(DATE_FORMAT),
    to: today.toFormat(DATE_FORMAT),
    timezone,
    start: start.toJSDate(),
    end: end.toJSDate(),
    previousStart: previousStart.toJSDate(),
    previousEnd: start.toJSDate(),
    bucket: 'day',
  };
};

const resolveCustomRange = ({
  from,
  to,
  timezone,
  today,
}: {
  from?: string;
  to?: string;
  timezone: string;
  today: DateTime;
}): TTeamAnalyticsResolvedRange => {
  if (!from || !to) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Custom analytics range requires both "from" and "to" dates',
    });
  }

  const fromDate = parseCalendarDate(from, timezone, 'from');
  const toDate = parseCalendarDate(to, timezone, 'to');

  if (fromDate > toDate) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Custom analytics range "from" must not be after "to"',
    });
  }

  if (toDate > today) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Custom analytics range "to" must not be in the future',
    });
  }

  const earliestFrom = today.minus(ANALYTICS_CUSTOM_RANGE_MAX_LOOKBACK);

  if (fromDate < earliestFrom) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Custom analytics range must start within the last year',
    });
  }

  const start = fromDate;
  const end = toDate.plus({ days: 1 });

  // Count calendar days rather than elapsed time so DST transitions do not skew the span.
  const spanDays = Math.round(end.diff(start, 'days').days);

  const previousStart = start.minus({ days: spanDays });

  return {
    range: 'custom',
    from: start.toFormat(DATE_FORMAT),
    to: toDate.toFormat(DATE_FORMAT),
    timezone,
    start: start.toJSDate(),
    end: end.toJSDate(),
    previousStart: previousStart.toJSDate(),
    previousEnd: start.toJSDate(),
    bucket: spanDays > CUSTOM_RANGE_MONTH_BUCKET_THRESHOLD_DAYS ? 'month' : 'day',
  };
};

/** Parse a strict yyyy-MM-dd calendar date at local midnight in `timezone`. */
const parseCalendarDate = (value: string, timezone: string, field: 'from' | 'to'): DateTime => {
  const parsed = DateTime.fromISO(value, { zone: timezone });

  // Round-trip guard: rejects non-date ISO strings (e.g. datetimes) and overflowing
  // dates such as 2023-02-30 that luxon would otherwise flag as invalid anyway.
  if (!parsed.isValid || parsed.toISODate() !== value) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Invalid custom analytics range "${field}" date, expected yyyy-MM-dd`,
    });
  }

  return parsed.startOf('day');
};
