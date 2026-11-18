import type { TGetTeamAnalyticsStatusBreakdownResponse } from '@documenso/trpc/server/team-router/get-team-analytics.types';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@documenso/ui/primitives/card';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import type { AnalyticsQueryResult } from '~/utils/analytics';

import { AnalyticsQueryError } from './analytics-query-error';

export type AnalyticsStatusBreakdownCardProps = {
  query: AnalyticsQueryResult<TGetTeamAnalyticsStatusBreakdownResponse>;
  className?: string;
};

export const AnalyticsStatusBreakdownCard = ({ query, className }: AnalyticsStatusBreakdownCardProps) => {
  const { _, i18n } = useLingui();

  const { data, isLoading, isError, refetch } = query;

  const rows = data ? allocatePercentages(STATUS_ROWS.map((row) => ({ ...row, count: data[row.key] }))) : [];

  return (
    <Card className={cn('flex flex-col', className)} data-testid="analytics-status-breakdown">
      <CardHeader className="flex flex-row items-start justify-between gap-x-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>
            <Trans>Status breakdown</Trans>
          </CardTitle>

          <CardDescription>
            <Trans>Documents created in this period</Trans>
          </CardDescription>
        </div>

        {data && (
          <p className="shrink-0 whitespace-nowrap">
            <span className="font-semibold text-2xl text-foreground tabular-nums tracking-tight">
              {data.total.toLocaleString(i18n.locale)}
            </span>{' '}
            <span className="text-muted-foreground text-sm">
              <Trans>total</Trans>
            </span>
          </p>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        {isError ? (
          <AnalyticsQueryError onRetry={refetch} />
        ) : isLoading || !data ? (
          <div className="flex flex-col gap-y-4">
            <Skeleton className="h-2.5 w-full rounded-full" />

            <div className="flex flex-col gap-y-2">
              {STATUS_ROWS.slice(0, 3).map((row) => (
                <Skeleton key={row.key} className="h-5 w-full" />
              ))}
            </div>
          </div>
        ) : data.total === 0 ? (
          <div className="flex flex-1 flex-col gap-y-4">
            <StatusBar segments={[]} label={_(msg`No documents in this period`)} />

            <p className="flex flex-1 items-center justify-center text-center text-muted-foreground text-sm">
              <Trans>No documents in this period</Trans>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-y-2">
            <StatusBar segments={rows} label={_(msg`Document status distribution`)} />

            <ul className="flex flex-col divide-y divide-border">
              {rows.map((row) => (
                <li key={row.key} className="flex items-center justify-between gap-x-3 py-2.5 text-sm">
                  <div className="flex min-w-0 items-center gap-x-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-foreground">{_(row.label)}</span>
                  </div>

                  <div className="flex shrink-0 items-baseline gap-x-2 tabular-nums">
                    <span className="font-medium text-foreground" data-testid={`analytics-status-${row.key}`}>
                      {row.count.toLocaleString(i18n.locale)}
                    </span>
                    <span className="w-10 text-right text-muted-foreground">{row.percent}%</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

type StatusBarProps = {
  segments: Array<{ key: string; percent: number; color: string }>;
  label: string;
};

/**
 * Stacked horizontal bar. Segment widths come from the largest-remainder
 * percentages so they always add up to the full width; an empty list renders
 * the muted track on its own.
 */
const StatusBar = ({ segments, label }: StatusBarProps) => {
  return (
    <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-muted" role="img" aria-label={label}>
      {segments.map((segment) => (
        <div
          key={segment.key}
          className="h-full"
          style={{ width: `${segment.percent}%`, backgroundColor: segment.color }}
        />
      ))}
    </div>
  );
};

type StatusKey = 'completed' | 'pending' | 'draft' | 'rejected' | 'cancelled';

type StatusRow = {
  key: StatusKey;
  label: MessageDescriptor;
  color: string;
};

/**
 * Single source of truth for status colours so the bar and the legend cannot drift.
 */
const STATUS_ROWS: StatusRow[] = [
  { key: 'completed', label: msg`Completed`, color: 'hsl(var(--primary))' },
  { key: 'pending', label: msg`Pending`, color: '#f59e0b' },
  { key: 'rejected', label: msg`Rejected`, color: '#ef4444' },
  { key: 'cancelled', label: msg`Cancelled`, color: '#f97316' },
  { key: 'draft', label: msg`Draft`, color: 'hsl(var(--muted-foreground) / 0.35)' },
];

/**
 * Assign integer percentages to the non-zero rows using largest-remainder
 * allocation so the values always sum to exactly 100, with every non-zero row
 * shown as at least 1%.
 */
const allocatePercentages = <T extends { count: number }>(rows: T[]): Array<T & { percent: number }> => {
  const visibleRows = rows.filter((row) => row.count > 0);
  const total = visibleRows.reduce((sum, row) => sum + row.count, 0);

  if (total === 0) {
    return [];
  }

  const allocations = visibleRows.map((row, index) => {
    const exact = (row.count / total) * 100;
    const floored = Math.floor(exact);

    return { index, percent: floored, remainder: exact - floored };
  });

  let remaining = 100 - allocations.reduce((sum, allocation) => sum + allocation.percent, 0);

  const byRemainder = [...allocations].sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const allocation of byRemainder) {
    if (remaining <= 0) {
      break;
    }

    allocation.percent += 1;
    remaining -= 1;
  }

  // Every non-zero row must display at least 1%; take the difference from the largest rows.
  const byPercentDesc = [...allocations].sort((a, b) => b.percent - a.percent || a.index - b.index);

  for (const allocation of allocations) {
    if (allocation.percent > 0) {
      continue;
    }

    allocation.percent = 1;

    const donor = byPercentDesc.find((candidate) => candidate !== allocation && candidate.percent > 1);

    if (donor) {
      donor.percent -= 1;
    }
  }

  return visibleRows.map((row, index) => ({ ...row, percent: allocations[index].percent }));
};
