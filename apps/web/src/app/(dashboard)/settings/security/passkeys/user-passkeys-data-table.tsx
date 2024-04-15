'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { DateTime } from 'luxon';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { ZBaseTableSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

import { UserPasskeysDataTableActions } from './user-passkeys-data-table-actions';

export const UserPasskeysDataTable = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const parsedSearchParams = ZBaseTableSearchParamsSchema.parse(
    Object.fromEntries(searchParams ?? []),
  );

  const { data, isLoading, isInitialLoading, isLoadingError } = trpc.auth.findPasskeys.useQuery(
    {
      page: parsedSearchParams.page,
      perPage: parsedSearchParams.perPage,
    },
    {
      keepPreviousData: true,
    },
  );

  const onPaginationChange = (page: number, perPage: number) => {
    updateSearchParams({
      page,
      perPage,
    });
  };

  const results = data ?? {
    data: [],
    perPage: 10,
    currentPage: 1,
    totalPages: 1,
  };

  return (
    <DataTable
      columns={[
        {
          header: 'Name',
          accessorKey: 'name',
        },
        {
          header: 'Created',
          accessorKey: 'createdAt',
          cell: ({ row }) => DateTime.fromJSDate(row.original.createdAt).toRelative(),
        },

        {
          header: 'Last used',
          accessorKey: 'updatedAt',
          cell: ({ row }) =>
            row.original.lastUsedAt
              ? DateTime.fromJSDate(row.original.lastUsedAt).toRelative()
              : 'Never',
        },
        {
          id: 'actions',
          cell: ({ row }) => (
            <UserPasskeysDataTableActions
              className="justify-end"
              passkeyId={row.original.id}
              passkeyName={row.original.name}
            />
          ),
        },
      ]}
      data={results.data}
      perPage={results.perPage}
      currentPage={results.currentPage}
      totalPages={results.totalPages}
      onPaginationChange={onPaginationChange}
      hasFilters={parsedSearchParams.page !== undefined || parsedSearchParams.perPage !== undefined}
      onClearFilters={() => router.push(pathname ?? '/')}
      error={{
        enable: isLoadingError,
      }}
      skeleton={{
        enable: isLoading && isInitialLoading,
        rows: 3,
        component: (
          <>
            <TableCell>
              <Skeleton className="h-4 w-20 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-12 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-12 rounded-full" />
            </TableCell>
            <TableCell>
              <div className="flex flex-row space-x-2">
                <Skeleton className="h-8 w-16 rounded" />
                <Skeleton className="h-8 w-16 rounded" />
              </div>
            </TableCell>
          </>
        ),
      }}
    >
      {(table) => <DataTablePagination table={table} />}
    </DataTable>
  );
};
