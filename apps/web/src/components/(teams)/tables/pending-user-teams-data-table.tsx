'use client';

import { useEffect, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { ZBaseTableSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

import { LocaleDate } from '~/components/formatter/locale-date';

import { CreateTeamCheckoutDialog } from '../dialogs/create-team-checkout-dialog';
import { PendingUserTeamsDataTableActions } from './pending-user-teams-data-table-actions';

export const PendingUserTeamsDataTable = () => {
  const searchParams = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const parsedSearchParams = ZBaseTableSearchParamsSchema.parse(
    Object.fromEntries(searchParams ?? []),
  );

  const [checkoutPendingTeamId, setCheckoutPendingTeamId] = useState<number | null>(null);

  const { data, isLoading, isInitialLoading, isLoadingError } = trpc.team.findTeamsPending.useQuery(
    {
      term: parsedSearchParams.query,
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

  useEffect(() => {
    const searchParamCheckout = searchParams?.get('checkout');

    if (searchParamCheckout && !isNaN(parseInt(searchParamCheckout))) {
      setCheckoutPendingTeamId(parseInt(searchParamCheckout));
      updateSearchParams({ checkout: null });
    }
  }, [searchParams, updateSearchParams]);

  return (
    <>
      <DataTable
        columns={[
          {
            header: 'Team',
            accessorKey: 'name',
            cell: ({ row }) => (
              <AvatarWithText
                avatarClass="h-12 w-12"
                avatarFallback={row.original.name.slice(0, 1).toUpperCase()}
                primaryText={
                  <span className="text-foreground/80 font-semibold">{row.original.name}</span>
                }
                secondaryText={`${WEBAPP_BASE_URL}/t/${row.original.url}`}
              />
            ),
          },
          {
            header: 'Created on',
            accessorKey: 'createdAt',
            cell: ({ row }) => <LocaleDate date={row.original.createdAt} />,
          },
          {
            id: 'actions',
            cell: ({ row }) => (
              <PendingUserTeamsDataTableActions
                className="justify-end"
                pendingTeamId={row.original.id}
                onPayClick={setCheckoutPendingTeamId}
              />
            ),
          },
        ]}
        data={results.data}
        perPage={results.perPage}
        currentPage={results.currentPage}
        totalPages={results.totalPages}
        onPaginationChange={onPaginationChange}
        error={{
          enable: isLoadingError,
        }}
        skeleton={{
          enable: isLoading && isInitialLoading,
          rows: 3,
          component: (
            <>
              <TableCell className="w-1/3 py-4 pr-4">
                <div className="flex w-full flex-row items-center">
                  <Skeleton className="h-12 w-12 flex-shrink-0 rounded-full" />

                  <div className="ml-2 flex flex-grow flex-col">
                    <Skeleton className="h-4 w-1/2 max-w-[8rem]" />
                    <Skeleton className="mt-1 h-4 w-2/3 max-w-[12rem]" />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded-full" />
              </TableCell>
              <TableCell>
                <div className="flex flex-row justify-end space-x-2">
                  <Skeleton className="h-10 w-16 rounded" />
                  <Skeleton className="h-10 w-20 rounded" />
                </div>
              </TableCell>
            </>
          ),
        }}
      >
        {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
      </DataTable>

      <CreateTeamCheckoutDialog
        pendingTeamId={checkoutPendingTeamId}
        onClose={() => setCheckoutPendingTeamId(null)}
      />
    </>
  );
};
