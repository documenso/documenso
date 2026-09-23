import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { cn } from '@documenso/ui/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@documenso/ui/primitives/card';
import { Input } from '@documenso/ui/primitives/input';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@documenso/ui/primitives/table';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { LucideIcon } from 'lucide-react';
import { SearchIcon, UsersIcon } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import type { AnalyticsQueryResult } from '~/utils/analytics';
import { formatRelativeDate } from '~/utils/analytics';

import { AnalyticsQueryError } from './analytics-query-error';

/** A single scope-agnostic row: a team member on the team page, a team on the organisation page. */
export type AnalyticsActivityRow = {
  key: string | number;
  avatar: {
    imageId: string | null;
    fallback: string;
  };
  title: string;
  subtitle?: string | null;
  sent: number;
  completed: number;
  pending: number;
  /** 0-100, null when nothing was sent. */
  completionRate: number | null;
  lastActiveAt: Date | null;
  /** When set the whole row navigates here and the title becomes a link. */
  href?: string;
};

export type AnalyticsActivityTableCardProps = {
  query: AnalyticsQueryResult<unknown>;
  /** Rows derived from `query.data`; empty while loading. */
  rows: AnalyticsActivityRow[];
  /** Identifies the current window (preset or custom span), so "Show all" resets whenever it changes. */
  rangeKey: string;
  title: ReactNode;
  description: ReactNode;
  /** Header of the first column, e.g. "Member". */
  columnLabel: ReactNode;
  /** Rendered next to the title once rows are loaded, e.g. "3 members · 2 active this period". */
  renderSummary: (count: number, activeCount: number) => ReactNode;
  /** Rendered next to "Show all", e.g. "Showing 8 of 9 members". */
  renderShowing: (visibleCount: number, totalCount: number) => ReactNode;
  emptyLabel: ReactNode;
  emptyIcon?: LucideIcon;
  /** Placeholder for the search input, e.g. "Search members". */
  searchPlaceholder: string;
  /** Rendered when the search matches nothing, e.g. "No members match your search". */
  noSearchResultsLabel: ReactNode;
  /** Builds the `analytics-{prefix}-*` test ids, e.g. `member` or `team`. */
  testIdPrefix: string;
  className?: string;
};

export const AnalyticsActivityTableCard = ({
  query,
  rows,
  rangeKey,
  title,
  description,
  columnLabel,
  renderSummary,
  renderShowing,
  emptyLabel,
  emptyIcon: EmptyIcon = UsersIcon,
  searchPlaceholder,
  noSearchResultsLabel,
  testIdPrefix,
  className,
}: AnalyticsActivityTableCardProps) => {
  const { i18n } = useLingui();

  // Tracks which window "Show all" was pressed for, so it resets whenever the window changes.
  const [expandedRangeKey, setExpandedRangeKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const isExpanded = expandedRangeKey === rangeKey;

  const { data, isLoading, isError, refetch } = query;

  const activeCount = rows.filter((row) => row.sent > 0).length;

  const normalisedSearchTerm = searchTerm.trim().toLowerCase();
  const isSearching = normalisedSearchTerm.length > 0;

  // Search always shows every match; the preview limit only applies to the unfiltered list.
  const filteredRows = isSearching ? rows.filter((row) => matchesSearch(row, normalisedSearchTerm)) : rows;
  const visibleRows = isExpanded || isSearching ? filteredRows : filteredRows.slice(0, ROW_PREVIEW_LIMIT);
  const hasHiddenRows = filteredRows.length > visibleRows.length;

  const testId = (suffix: string) => `analytics-${testIdPrefix}-${suffix}`;

  return (
    <Card className={className} data-testid={testId('activity')}>
      <CardHeader className="gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col space-y-1.5">
          <CardTitle>{title}</CardTitle>

          <CardDescription>{description}</CardDescription>
        </div>

        {data !== undefined && rows.length > 0 && (
          <p className="shrink-0 text-muted-foreground text-sm tabular-nums" data-testid={testId('summary')}>
            {renderSummary(rows.length, activeCount)}
          </p>
        )}
      </CardHeader>

      <CardContent>
        {isError ? (
          <AnalyticsQueryError onRetry={refetch} />
        ) : isLoading || data === undefined ? (
          <ul className="flex flex-col gap-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <li key={index} className="flex items-center gap-x-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />

                <div className="flex flex-1 flex-col gap-y-1.5">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>

                <Skeleton className="h-4 w-10" />
                <Skeleton className="hidden h-4 w-10 md:block" />
                <Skeleton className="hidden h-4 w-10 md:block" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="hidden h-4 w-20 md:block" />
              </li>
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-y-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <EmptyIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>

            <p className="max-w-sm text-muted-foreground text-sm">{emptyLabel}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-y-3">
            <div className="relative sm:max-w-xs">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />

              <Input
                type="search"
                className="pl-9"
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                data-testid={testId('search')}
              />
            </div>

            {filteredRows.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground text-sm" data-testid={testId('no-results')}>
                {noSearchResultsLabel}
              </p>
            ) : (
              <>
                {/* Pull the table out to the card edge so the first/last cell gutters (px-6) line up with the header. */}
                <div className="-mx-6">
                  <Table className="[&_td]:px-2 md:[&_td]:px-4 [&_th]:px-2 md:[&_th]:px-4">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className={FIRST_CELL_CLASS}>{columnLabel}</TableHead>
                        <TableHead className="text-right">
                          <Trans>Sent</Trans>
                        </TableHead>
                        <TableHead className="hidden text-right md:table-cell">
                          <Trans>Completed</Trans>
                        </TableHead>
                        <TableHead className="hidden text-right md:table-cell">
                          <Trans>Pending</Trans>
                        </TableHead>
                        <TableHead className={cn('text-right', LAST_CELL_ON_MOBILE_CLASS)}>
                          <Trans>Completion rate</Trans>
                        </TableHead>
                        <TableHead className={cn('hidden text-right md:table-cell', LAST_CELL_CLASS)}>
                          <Trans>Last active</Trans>
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {visibleRows.map((row) => (
                        <ActivityRow key={row.key} row={row} locale={i18n.locale} testIdPrefix={testIdPrefix} />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {hasHiddenRows && (
                  <div className="flex items-center justify-between gap-x-4 border-border border-t pt-3">
                    <p className="text-muted-foreground text-sm" data-testid={testId('showing')}>
                      {renderShowing(visibleRows.length, filteredRows.length)}
                    </p>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="-mr-2"
                      onClick={() => setExpandedRangeKey(rangeKey)}
                      data-testid={testId('show-all')}
                    >
                      <Trans>Show all</Trans>
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

type ActivityRowProps = {
  row: AnalyticsActivityRow;
  locale: string;
  testIdPrefix: string;
};

const ActivityRow = ({ row, locale, testIdPrefix }: ActivityRowProps) => {
  const { _ } = useLingui();
  const navigate = useNavigate();

  const isActive = row.sent > 0;

  const testId = (suffix: string) => `analytics-${testIdPrefix}-${suffix}`;

  // Only "Completed" and the rate are emphasised; supporting counts stay muted. Inactive rows are muted throughout.
  const primaryNumberClass = cn('text-right tabular-nums', isActive ? 'text-foreground' : 'text-muted-foreground');
  const secondaryNumberClass = 'text-right text-muted-foreground tabular-nums';

  // role="img" so the aria-label is valid (a bare span has no role that supports it).
  const notAvailable = (
    <span role="img" aria-label={_(msg`Not available`)}>
      —
    </span>
  );

  /**
   * The title link is the accessible target; clicking anywhere else on the row
   * navigates too. Modifier clicks and clicks on the link itself are left to the
   * browser so open-in-new-tab keeps working, and drag-selecting text does not
   * navigate.
   */
  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (!row.href || event.defaultPrevented || event.button !== 0) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    if (event.target instanceof Element && event.target.closest('a')) {
      return;
    }

    if (window.getSelection()?.toString()) {
      return;
    }

    void navigate(row.href);
  };

  return (
    <TableRow
      className={cn(row.href && 'cursor-pointer')}
      onClick={handleRowClick}
      data-testid={testId('row')}
      data-active={isActive ? 'true' : 'false'}
    >
      {/* w-full + max-w-0 lets this cell absorb the remaining width while still truncating its content. */}
      <TableCell truncate={false} className={cn('w-full max-w-0', FIRST_CELL_CLASS)}>
        <div className="flex min-w-0 items-center gap-x-3">
          <Avatar className="h-9 w-9 shrink-0">
            {row.avatar.imageId && <AvatarImage src={formatAvatarUrl(row.avatar.imageId)} />}
            <AvatarFallback className="text-muted-foreground text-xs">{row.avatar.fallback}</AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-col">
            {row.href ? (
              <Link
                to={row.href}
                className={cn(
                  'truncate font-medium text-sm hover:underline',
                  isActive ? 'text-foreground' : 'text-foreground/80',
                )}
              >
                {row.title}
              </Link>
            ) : (
              <span className={cn('truncate font-medium text-sm', isActive ? 'text-foreground' : 'text-foreground/80')}>
                {row.title}
              </span>
            )}

            {row.subtitle && <span className="truncate text-muted-foreground text-xs">{row.subtitle}</span>}
          </div>
        </div>
      </TableCell>

      <TableCell className={secondaryNumberClass} data-testid={testId('sent')}>
        {row.sent.toLocaleString(locale)}
      </TableCell>

      <TableCell className={cn('hidden md:table-cell', primaryNumberClass)} data-testid={testId('completed')}>
        {row.completed.toLocaleString(locale)}
      </TableCell>

      <TableCell className={cn('hidden md:table-cell', secondaryNumberClass)} data-testid={testId('pending')}>
        {row.pending.toLocaleString(locale)}
      </TableCell>

      <TableCell className={cn(primaryNumberClass, LAST_CELL_ON_MOBILE_CLASS)} data-testid={testId('completion-rate')}>
        {row.completionRate === null ? (
          notAvailable
        ) : (
          <div className="flex items-center justify-end gap-x-2">
            <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block" aria-hidden="true">
              <div className="h-full rounded-full bg-primary" style={{ width: `${row.completionRate}%` }} />
            </div>

            <span className="w-9 text-right">{Math.round(row.completionRate)}%</span>
          </div>
        )}
      </TableCell>

      <TableCell
        className={cn('hidden md:table-cell', secondaryNumberClass, LAST_CELL_CLASS)}
        data-testid={testId('last-active')}
      >
        {row.lastActiveAt === null ? notAvailable : formatRelativeDate(row.lastActiveAt, locale)}
      </TableCell>
    </TableRow>
  );
};

const ROW_PREVIEW_LIMIT = 8;

const matchesSearch = (row: AnalyticsActivityRow, term: string) => {
  return row.title.toLowerCase().includes(term) || (row.subtitle ?? '').toLowerCase().includes(term);
};

/**
 * The table is pulled out to the card edge (-mx-6), so the outer cells get the
 * card's px-6 gutter to line up with the header. "Last active" is hidden below
 * md, so "Completion rate" takes the right gutter there.
 */
const FIRST_CELL_CLASS = '!pl-6';
const LAST_CELL_CLASS = '!pr-6';
const LAST_CELL_ON_MOBILE_CLASS = '!pr-6 md:!pr-4';
