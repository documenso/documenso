import type { TTeamAnalyticsRange } from '@documenso/trpc/server/team-router/get-team-analytics.types';
import {
  ANALYTICS_CUSTOM_RANGE_MAX_LOOKBACK,
  ZAnalyticsDateSchema,
  ZTeamAnalyticsRangeSchema,
} from '@documenso/trpc/server/team-router/get-team-analytics.types';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { DateTime, IANAZone, Interval } from 'luxon';
import { createParser, parseAsStringEnum, useQueryStates } from 'nuqs';
import { useEffect, useMemo } from 'react';

/**
 * The subset of a tRPC query result the analytics cards need. The queries live on
 * the page (team or organisation) so the cards stay scope-agnostic.
 */
export type AnalyticsQueryResult<TData> = {
  data: TData | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
};

export type TAnalyticsPresetRange = Exclude<TTeamAnalyticsRange, 'custom'>;

/**
 * A fully specified analytics range: either a preset, or a custom inclusive
 * [from, to] window of yyyy-MM-dd calendar dates in the browser timezone.
 */
export type AnalyticsRangeValue =
  | { range: TAnalyticsPresetRange; from?: undefined; to?: undefined }
  | { range: 'custom'; from: string; to: string };

export const ANALYTICS_PRESET_RANGES: TAnalyticsPresetRange[] = ZTeamAnalyticsRangeSchema.options.filter(
  (range): range is TAnalyticsPresetRange => range !== 'custom',
);

export const ANALYTICS_RANGE_LABELS: Record<TTeamAnalyticsRange, MessageDescriptor> = {
  '7d': msg`Last 7 days`,
  '30d': msg`Last 30 days`,
  '90d': msg`Last 90 days`,
  '12m': msg`Last 12 months`,
  custom: msg`Custom range`,
};

export const ANALYTICS_NO_ACTIVITY_LABELS: Record<TTeamAnalyticsRange, MessageDescriptor> = {
  '7d': msg`No activity in the last 7 days.`,
  '30d': msg`No activity in the last 30 days.`,
  '90d': msg`No activity in the last 90 days.`,
  '12m': msg`No activity in the last 12 months.`,
  custom: msg`No activity in the selected range.`,
};

const DEFAULT_ANALYTICS_RANGE: TAnalyticsPresetRange = '30d';

/**
 * The browser's IANA timezone, falling back to UTC when it cannot be resolved or
 * is not a zone luxon recognises. Client-only.
 */
export const resolveBrowserTimezone = () => {
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return IANAZone.isValidZone(browserTimezone) ? browserTimezone : 'UTC';
};

export const formatRelativeDate = (date: Date, locale: string) => {
  return DateTime.fromJSDate(date).setLocale(locale).toRelative() ?? '';
};

/** Parse a strict yyyy-MM-dd calendar date at local midnight, null when invalid. */
export const parseAnalyticsDate = (value: string): DateTime | null => {
  if (!ZAnalyticsDateSchema.safeParse(value).success) {
    return null;
  }

  const parsed = DateTime.fromISO(value);

  // Round-trip guard so overflowing dates such as 2023-02-30 are rejected.
  if (!parsed.isValid || parsed.toISODate() !== value) {
    return null;
  }

  return parsed.startOf('day');
};

/** Format a local `Date` (e.g. one picked in the calendar) as yyyy-MM-dd. */
export const formatAnalyticsDate = (date: Date): string => {
  return DateTime.fromJSDate(date).toISODate() ?? '';
};

/** Human readable inclusive span, e.g. "Feb 1 – 29, 2024". */
export const formatAnalyticsDateRange = (from: string, to: string, locale: string): string => {
  const start = DateTime.fromISO(from);
  const end = DateTime.fromISO(to);

  if (!start.isValid || !end.isValid) {
    return `${from} – ${to}`;
  }

  return Interval.fromDateTimes(start, end).toLocaleString(DateTime.DATE_MED, { locale });
};

/** Number of calendar days in the inclusive [from, to] window, 0 when invalid. */
export const getAnalyticsDateRangeDays = (from: string, to: string): number => {
  const start = parseAnalyticsDate(from);
  const end = parseAnalyticsDate(to);

  if (!start || !end || start > end) {
    return 0;
  }

  return Math.round(end.diff(start, 'days').days) + 1;
};

/**
 * Validate a custom window client-side, mirroring the backend resolver: both
 * dates present and valid, ordered, not in the future and within the maximum span.
 */
export const isValidAnalyticsCustomRange = (from: string | null, to: string | null): boolean => {
  if (!from || !to) {
    return false;
  }

  const start = parseAnalyticsDate(from);
  const end = parseAnalyticsDate(to);

  if (!start || !end || start > end) {
    return false;
  }

  const today = DateTime.local().startOf('day');

  if (end > today) {
    return false;
  }

  return start >= today.minus(ANALYTICS_CUSTOM_RANGE_MAX_LOOKBACK);
};

const parseAsAnalyticsDate = createParser<string>({
  parse: (value) => (parseAnalyticsDate(value) ? value : null),
  serialize: (value) => value,
});

export const analyticsRangeSearchParams = {
  range: parseAsStringEnum(ZTeamAnalyticsRangeSchema.options).withDefault(DEFAULT_ANALYTICS_RANGE),
  from: parseAsAnalyticsDate,
  to: parseAsAnalyticsDate,
};

/**
 * The analytics range held in the URL (`?range=`, plus `?from=&to=` for custom
 * ranges). A custom range with missing or invalid bounds falls back to the default
 * preset and the stray params are cleared from the URL.
 */
export const useAnalyticsRange = () => {
  const [{ range, from, to }, setSearchParams] = useQueryStates(analyticsRangeSearchParams);

  const value = useMemo((): AnalyticsRangeValue => {
    if (range !== 'custom') {
      return { range };
    }

    if (from && to && isValidAnalyticsCustomRange(from, to)) {
      return { range, from, to };
    }

    return { range: DEFAULT_ANALYTICS_RANGE };
  }, [range, from, to]);

  const hasInvalidCustomRange = range === 'custom' && value.range !== 'custom';

  useEffect(() => {
    if (hasInvalidCustomRange) {
      void setSearchParams({ range: null, from: null, to: null });
    }
  }, [hasInvalidCustomRange, setSearchParams]);

  const setValue = (next: AnalyticsRangeValue) => {
    if (next.range === 'custom') {
      void setSearchParams({ range: next.range, from: next.from, to: next.to });

      return;
    }

    void setSearchParams({ range: next.range, from: null, to: null });
  };

  /** Changes whenever the effective window changes, including a custom span being adjusted. */
  const rangeKey = `${value.range}:${value.from ?? ''}:${value.to ?? ''}`;

  return { value, rangeKey, setValue };
};
