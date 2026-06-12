import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { currentMonthlyPeriod } from '@documenso/lib/universal/monthly-period';
import { trpc } from '@documenso/trpc/react';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { useLingui } from '@lingui/react/macro';
import { ChevronDownIcon, ChevronsUpDownIcon, ChevronUpIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';

type OrderByColumn = 'documentCount' | 'emailCount' | 'apiCount' | 'emailReports' | 'totalCount';
type OrderByDirection = 'asc' | 'desc';

const parseOrderByColumn = (value: string | undefined): OrderByColumn | undefined => {
  if (
    value === 'documentCount' ||
    value === 'emailCount' ||
    value === 'apiCount' ||
    value === 'emailReports' ||
    value === 'totalCount'
  ) {
    return value;
  }

  return undefined;
};

const parseOrderByDirection = (value: string | undefined): OrderByDirection => {
  return value === 'asc' ? 'asc' : 'desc';
};

/**
 * Number of days to divide the period's usage by to get a per-day average.
 *
 * For the in-progress (current) month we divide by today's UTC day-of-month so the
 * average reflects elapsed days only. For a fully-elapsed past month we divide by the
 * total number of days in that month.
 */
const getPeriodDivisor = (period: string): number => {
  if (period === currentMonthlyPeriod()) {
    return new Date().getUTCDate();
  }

  const [yearStr, monthStr] = period.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (Number.isNaN(year) || Number.isNaN(month)) {
    return new Date().getUTCDate();
  }

  // Day 0 of the following month resolves to the last day of `month`.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

export type OrganisationStatsDisplayMode = 'usage' | 'quotas' | 'averages';

type AdminOrganisationStatsTableProps = {
  displayMode?: OrganisationStatsDisplayMode;
};

export const AdminOrganisationStatsTable = ({ displayMode = 'usage' }: AdminOrganisationStatsTableProps) => {
  const { t } = useLingui();

  const [searchParams, setSearchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const parsedSearchParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));

  // Default to the current month.
  const period = searchParams?.get('period') ?? currentMonthlyPeriod();
  const claimId = searchParams?.get('claimId') || undefined;
  const orderByColumn = parseOrderByColumn(searchParams?.get('orderByColumn') ?? undefined);
  const orderByDirection = parseOrderByDirection(searchParams?.get('orderByDirection') ?? undefined);

  const { data, isLoading, isLoadingError } = trpc.admin.organisation.stats.find.useQuery({
    query: parsedSearchParams.query,
    page: parsedSearchParams.page,
    perPage: parsedSearchParams.perPage,
    period,
    claimId,
    orderByColumn,
    orderByDirection,
  });

  const onPaginationChange = (page: number, perPage: number) => {
    updateSearchParams({
      page,
      perPage,
    });
  };

  const handleColumnSort = (column: OrderByColumn) => {
    const nextDirection = orderByColumn === column && orderByDirection === 'desc' ? 'asc' : 'desc';

    // Use the functional updater so we merge onto the latest params. Reading the
    // captured `searchParams` here would drop filters (e.g. claimId) that changed
    // after this handler was memoised into the column definitions.
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);

      next.set('orderByColumn', column);
      next.set('orderByDirection', nextDirection);
      next.set('page', '1');

      return next;
    });
  };

  const results = data ?? {
    data: [],
    perPage: 10,
    currentPage: 1,
    totalPages: 1,
  };

  const columns = useMemo(() => {
    const divisor = getPeriodDivisor(period);

    const formatPerDay = (used: number) => {
      const perDay = divisor > 0 ? used / divisor : 0;
      const rounded = Math.round(perDay * 10) / 10;

      return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    };

    const renderUsageCell = (used: number, quota: number | null) => {
      if (displayMode === 'averages') {
        return formatPerDay(used);
      }

      if (displayMode === 'quotas') {
        return (
          <span>
            {used}/{quota === null ? '∞' : quota}
          </span>
        );
      }

      return <span>{used}</span>;
    };

    const sortableHeader = (label: string, column: OrderByColumn) => (
      <button
        type="button"
        className="flex cursor-pointer items-center whitespace-nowrap"
        onClick={() => handleColumnSort(column)}
      >
        {label}
        {orderByColumn === column ? (
          orderByDirection === 'asc' ? (
            <ChevronUpIcon className="ml-2 h-4 w-4" />
          ) : (
            <ChevronDownIcon className="ml-2 h-4 w-4" />
          )
        ) : (
          <ChevronsUpDownIcon className="ml-2 h-4 w-4" />
        )}
      </button>
    );

    return [
      {
        header: t`Organisation`,
        accessorKey: 'organisationName',
        cell: ({ row }) => (
          <Link to={`/admin/organisations/${row.original.organisationId}`} className="text-sm hover:underline">
            {row.original.organisationName}
          </Link>
        ),
      },
      {
        header: t`Claim`,
        accessorKey: 'originalClaimId',
        cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.originalClaimId ?? '—'}</span>,
      },
      {
        header: t`Period`,
        accessorKey: 'period',
        cell: ({ row }) => <span className="text-sm">{row.original.period}</span>,
      },
      {
        header: () => sortableHeader(t`Documents`, 'documentCount'),
        accessorKey: 'documentCount',
        cell: ({ row }) => renderUsageCell(row.original.documentCount, row.original.documentQuota),
      },
      {
        header: () => sortableHeader(t`Emails`, 'emailCount'),
        accessorKey: 'emailCount',
        cell: ({ row }) => renderUsageCell(row.original.emailCount, row.original.emailQuota),
      },
      {
        header: () => sortableHeader(t`API`, 'apiCount'),
        accessorKey: 'apiCount',
        cell: ({ row }) => renderUsageCell(row.original.apiCount, row.original.apiQuota),
      },
      {
        header: () => sortableHeader(t`Reports`, 'emailReports'),
        accessorKey: 'emailReports',
        cell: ({ row }) => row.original.emailReports,
      },
      {
        header: () => sortableHeader(t`Total`, 'totalCount'),
        accessorKey: 'totalCount',
        cell: ({ row }) => <span className="font-medium">{row.original.totalCount}</span>,
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
    // `searchParams` must be a dependency: `handleColumnSort` closes over `setSearchParams`,
    // whose functional updater is bound to the `searchParams` captured at creation time.
    // Without this, changing a filter (e.g. claimId) wouldn't refresh the memoised handler,
    // and sorting would merge onto stale params and drop the active filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, orderByColumn, orderByDirection, period, displayMode, searchParams]);

  return (
    <div>
      <DataTable
        columns={columns}
        data={results.data}
        rowClassName="text-sm"
        perPage={results.perPage}
        currentPage={results.currentPage}
        totalPages={results.totalPages}
        onPaginationChange={onPaginationChange}
        error={{
          enable: isLoadingError,
        }}
        skeleton={{
          enable: isLoading,
          rows: 5,
          component: (
            <>
              <TableCell className="py-4 pr-4">
                <Skeleton className="h-4 w-32 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-10 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-10 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-10 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-10 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-10 rounded-full" />
              </TableCell>
            </>
          ),
        }}
      >
        {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
      </DataTable>
    </div>
  );
};
