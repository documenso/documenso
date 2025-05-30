import { DateTime } from 'luxon';

export type TimePeriod =
  | 'today'
  | 'this-week'
  | 'this-month'
  | 'this-quarter'
  | 'this-year'
  | 'yesterday'
  | 'last-week'
  | 'last-month'
  | 'last-quarter'
  | 'last-year'
  | 'all-time';

export function getDateRangeForPeriod(
  period: TimePeriod,
): { start: DateTime; end: DateTime } | null {
  const now = DateTime.now();

  switch (period) {
    case 'today':
      return {
        start: now.startOf('day'),
        end: now.endOf('day'),
      };

    case 'yesterday': {
      const yesterday = now.minus({ days: 1 });
      return {
        start: yesterday.startOf('day'),
        end: yesterday.endOf('day'),
      };
    }

    case 'this-week':
      return {
        start: now.startOf('week'),
        end: now.endOf('week'),
      };

    case 'last-week': {
      const lastWeek = now.minus({ weeks: 1 });
      return {
        start: lastWeek.startOf('week'),
        end: lastWeek.endOf('week'),
      };
    }

    case 'this-month':
      return {
        start: now.startOf('month'),
        end: now.endOf('month'),
      };

    case 'last-month': {
      const lastMonth = now.minus({ months: 1 });
      return {
        start: lastMonth.startOf('month'),
        end: lastMonth.endOf('month'),
      };
    }

    case 'this-quarter':
      return {
        start: now.startOf('quarter'),
        end: now.endOf('quarter'),
      };

    case 'last-quarter': {
      const lastQuarter = now.minus({ quarters: 1 });
      return {
        start: lastQuarter.startOf('quarter'),
        end: lastQuarter.endOf('quarter'),
      };
    }

    case 'this-year':
      return {
        start: now.startOf('year'),
        end: now.endOf('year'),
      };

    case 'last-year': {
      const lastYear = now.minus({ years: 1 });
      return {
        start: lastYear.startOf('year'),
        end: lastYear.endOf('year'),
      };
    }

    case 'all-time':
      return null;

    default:
      return null;
  }
}

export function isDateInPeriod(date: Date, period: TimePeriod): boolean {
  const dateTime = DateTime.fromJSDate(date);

  if (period === 'all-time') {
    return true;
  }

  const range = getDateRangeForPeriod(period);
  if (!range) {
    return true;
  }

  return dateTime >= range.start && dateTime <= range.end;
}
