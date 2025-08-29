import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { DateTime } from 'luxon';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

import { SettingsSecurityPasskeyTableActions } from './settings-security-passkey-table-actions';

export const SettingsSecurityPasskeyTable = () => {
  const { _ } = useLingui();

  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const updateSearchParams = useUpdateSearchParams();

  const parsedSearchParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));

  const { data, isLoading, isLoadingError } = trpc.auth.passkey.find.useQuery(
    {
      page: parsedSearchParams.page,
      perPage: parsedSearchParams.perPage,
    },
    {
      placeholderData: (previousData) => previousData,
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

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Name`),
        accessorKey: 'name',
      },
      {
        header: _(msg`Created`),
        accessorKey: 'createdAt',
        cell: ({ row }) => DateTime.fromJSDate(row.original.createdAt).toRelative(),
      },

      {
        header: _(msg`Last used`),
        accessorKey: 'updatedAt',
        cell: ({ row }) =>
          row.original.lastUsedAt
            ? DateTime.fromJSDate(row.original.lastUsedAt).toRelative()
            : _(msg`Never`),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <SettingsSecurityPasskeyTableActions
            className="justify-end"
            passkeyId={row.original.id}
            passkeyName={row.original.name}
          />
        ),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, []);

  return (
    <DataTable
      columns={columns}
      data={results.data}
      perPage={results.perPage}
      currentPage={results.currentPage}
      totalPages={results.totalPages}
      onPaginationChange={onPaginationChange}
      hasFilters={parsedSearchParams.page !== undefined || parsedSearchParams.perPage !== undefined}
      onClearFilters={async () => navigate(pathname ?? '/')}
      error={{
        enable: isLoadingError,
      }}
      skeleton={{
        enable: isLoading,
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
