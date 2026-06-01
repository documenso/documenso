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

type OrderByColumn = 'documentCount' | 'emailCount' | 'apiCount' | 'totalCount';
type OrderByDirection = 'asc' | 'desc';

const parseOrderByColumn = (value: string | undefined): OrderByColumn | undefined => {
  if (value === 'documentCount' || value === 'emailCount' || value === 'apiCount' || value === 'totalCount') {
    return value;
  }

  return undefined;
};

const parseOrderByDirection = (value: string | undefined): OrderByDirection => {
  return value === 'asc' ? 'asc' : 'desc';
};

export const AdminOrganisationStatsTable = () => {
  const { t } = useLingui();

  const [searchParams] = useSearchParams();
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

    updateSearchParams({
      orderByColumn: column,
      orderByDirection: nextDirection,
      page: 1,
    });
  };

  const results = data ?? {
    data: [],
    perPage: 10,
    currentPage: 1,
    totalPages: 1,
  };

  const columns = useMemo(() => {
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
          <Link to={`/admin/organisations/${row.original.organisationId}`} className="hover:underline">
            {row.original.organisationName}
          </Link>
        ),
      },
      {
        header: t`Claim`,
        accessorKey: 'originalClaimId',
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.originalClaimId ?? '—'}</span>,
      },
      {
        header: t`Period`,
        accessorKey: 'period',
        cell: ({ row }) => row.original.period,
      },
      {
        header: () => sortableHeader(t`Documents`, 'documentCount'),
        accessorKey: 'documentCount',
        cell: ({ row }) => row.original.documentCount,
      },
      {
        header: () => sortableHeader(t`Emails`, 'emailCount'),
        accessorKey: 'emailCount',
        cell: ({ row }) => row.original.emailCount,
      },
      {
        header: () => sortableHeader(t`API`, 'apiCount'),
        accessorKey: 'apiCount',
        cell: ({ row }) => row.original.apiCount,
      },
      {
        header: () => sortableHeader(t`Total`, 'totalCount'),
        accessorKey: 'totalCount',
        cell: ({ row }) => <span className="font-medium">{row.original.totalCount}</span>,
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, orderByColumn, orderByDirection]);

  return (
    <div>
      <DataTable
        columns={columns}
        data={results.data}
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
            </>
          ),
        }}
      >
        {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
      </DataTable>
    </div>
  );
};
