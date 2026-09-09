import { DateTime, IANAZone } from 'luxon';

import { AppError, AppErrorCode } from '../errors/app-error';

/** Calendar units supported by team analytics. */
export type AnalyticsPeriodUnit = 'day' | 'week' | 'month' | 'year';

/** A calendar period resolved to a half-open range. */
export type AnalyticsPeriod = {
  unit: AnalyticsPeriodUnit;
  date: string;
  timezone: string;
  start: Date;
  end: Date;
};

/**
 * Resolve the calendar period containing `date` in an IANA timezone.
 */
export const resolveAnalyticsPeriod = ({
  period,
  date,
  timezone,
  now = new Date(),
}: {
  period: AnalyticsPeriodUnit;
  date: string;
  timezone: string;
  now?: Date;
}): AnalyticsPeriod => {
  if (timezone !== 'UTC' && !IANAZone.isValidZone(timezone)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid analytics timezone',
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid analytics date',
    });
  }

  const selectedDate = DateTime.fromISO(date, { zone: timezone });
  const currentTime = DateTime.fromJSDate(now, { zone: timezone });

  if (!selectedDate.isValid || selectedDate.toISODate() !== date || !currentTime.isValid) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid analytics date',
    });
  }

  const start = selectedDate.startOf(period);
  const end = start.plus({ [`${period}s`]: 1 });

  if (start.toMillis() > currentTime.toMillis()) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Analytics period cannot be in the future',
    });
  }

  return {
    unit: period,
    date: start.toFormat('yyyy-MM-dd'),
    timezone,
    start: start.toJSDate(),
    end: end.toJSDate(),
  };
};
