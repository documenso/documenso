import type { TGetTeamAnalyticsDocumentsOverTimeResponse } from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@documenso/ui/primitives/card';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { useLingui } from '@lingui/react';
import { Plural, Trans } from '@lingui/react/macro';
import { BarChart3Icon } from 'lucide-react';
import { DateTime } from 'luxon';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { AnalyticsQueryResult, AnalyticsRangeValue } from '~/utils/analytics';
import { getAnalyticsDateRangeDays } from '~/utils/analytics';

import { AnalyticsQueryError } from './analytics-query-error';

export type AnalyticsDocumentsOverTimeCardProps = {
  range: AnalyticsRangeValue;
  query: AnalyticsQueryResult<TGetTeamAnalyticsDocumentsOverTimeResponse>;
  className?: string;
};

type Bucket = TGetTeamAnalyticsDocumentsOverTimeResponse['range']['bucket'];

export const AnalyticsDocumentsOverTimeCard = ({ range, query, className }: AnalyticsDocumentsOverTimeCardProps) => {
  const { i18n } = useLingui();

  const { data, isPending, isError, isRefetching, isPlaceholderData, refetch } = query;

  // The backend decides the bucket, and it must match the points being rendered
  // (including stale placeholder data) so the tick and tooltip formatting line up.
  // Before any data arrives it is guessed from the requested range.
  const bucket: Bucket = data ? data.range.bucket : guessBucket(range);

  const tickInterval = data ? getTickInterval(data.points.length, bucket) : 0;

  return (
    <Card
      className={cn('flex flex-col transition-opacity', isPlaceholderData && 'opacity-60', className)}
      aria-busy={isPlaceholderData ? 'true' : undefined}
      data-testid="analytics-documents-over-time"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-x-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>
            <Trans>Documents created</Trans>
          </CardTitle>

          <CardDescription>{bucket === 'month' ? <Trans>Monthly</Trans> : <Trans>Daily</Trans>}</CardDescription>
        </div>

        {data && (
          <p className="shrink-0 whitespace-nowrap" data-testid="analytics-documents-over-time-total">
            <span className="font-semibold text-2xl text-foreground tabular-nums tracking-tight">
              {data.total.toLocaleString(i18n.locale)}
            </span>{' '}
            <span className="text-muted-foreground text-sm">
              <Trans>total</Trans>
            </span>
          </p>
        )}
      </CardHeader>

      {/* flex-1 + justify-center keeps the fixed-height chart vertically level with the status breakdown card. */}
      <CardContent className="flex flex-1 flex-col justify-center">
        {isError ? (
          <AnalyticsQueryError onRetry={() => void refetch()} isRetrying={isRefetching} />
        ) : isPending || !data ? (
          <Skeleton className="w-full" style={{ height: CHART_HEIGHT }} />
        ) : data.total === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-y-3 text-center"
            style={{ height: CHART_HEIGHT }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BarChart3Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>

            <p className="text-muted-foreground text-sm">
              <Trans>No documents created in this period</Trans>
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={data.points} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />

              <XAxis
                dataKey="date"
                interval={tickInterval}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value: string) => formatTickLabel(value, bucket, i18n.locale)}
              />

              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={36}
                tickCount={4}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />

              <Tooltip
                content={<DocumentsOverTimeTooltip bucket={bucket} locale={i18n.locale} />}
                cursor={{ fill: 'hsl(var(--muted-foreground) / 0.08)' }}
              />

              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                background={{ fill: 'hsl(var(--muted) / 0.5)', radius: 4 }}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

type DocumentsOverTimeTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: { date: string; count: number } }>;
  bucket: Bucket;
  locale: string;
};

const DocumentsOverTimeTooltip = ({ active, payload, bucket, locale }: DocumentsOverTimeTooltipProps) => {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  const count = Number(point.count ?? 0);

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground text-sm shadow-md">
      <p className="text-muted-foreground text-xs">{formatTooltipLabel(point.date, bucket, locale)}</p>

      <p className="mt-0.5 font-medium tabular-nums">
        <Plural value={count} one="# document" other="# documents" />
      </p>
    </div>
  );
};

const CHART_HEIGHT = 240;

const TARGET_DAILY_TICK_COUNT = 6;

/** Mirrors the backend resolver: custom windows longer than this are bucketed by month. */
const CUSTOM_RANGE_MONTH_BUCKET_THRESHOLD_DAYS = 92;

const guessBucket = (range: AnalyticsRangeValue): Bucket => {
  if (range.range === '12m') {
    return 'month';
  }

  if (range.range === 'custom') {
    return getAnalyticsDateRangeDays(range.from, range.to) > CUSTOM_RANGE_MONTH_BUCKET_THRESHOLD_DAYS ? 'month' : 'day';
  }

  return 'day';
};

/**
 * Month buckets label every month (12 fit at the lg width) and let recharts drop
 * overlapping ones on narrow screens; daily buckets show roughly six evenly spaced labels.
 */
const getTickInterval = (pointCount: number, bucket: Bucket): number | 'preserveStartEnd' => {
  if (bucket === 'month') {
    return 'preserveStartEnd';
  }

  if (pointCount <= TARGET_DAILY_TICK_COUNT) {
    return 0;
  }

  return Math.max(0, Math.round(pointCount / TARGET_DAILY_TICK_COUNT) - 1);
};

const formatTickLabel = (date: string, bucket: Bucket, locale: string) => {
  const parsed = DateTime.fromISO(date).setLocale(locale);

  if (bucket === 'month') {
    return parsed.toLocaleString({ month: 'short' });
  }

  return parsed.toLocaleString({ month: 'short', day: 'numeric' });
};

const formatTooltipLabel = (date: string, bucket: Bucket, locale: string) => {
  const parsed = DateTime.fromISO(date).setLocale(locale);

  if (bucket === 'month') {
    return parsed.toLocaleString({ month: 'long', year: 'numeric' });
  }

  return parsed.toLocaleString(DateTime.DATE_FULL);
};
