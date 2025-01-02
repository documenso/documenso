import { useEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useSearchParams } from 'react-router';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

import { TeamCheckoutCreateDialog } from '~/components/dialogs/team-checkout-create-dialog';

import { UserSettingsPendingTeamsTableActions } from './user-settings-pending-teams-table-actions';

export const UserSettingsPendingTeamsDataTable = () => {
  const { _, i18n } = useLingui();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const parsedSearchParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));

  const [checkoutPendingTeamId, setCheckoutPendingTeamId] = useState<number | null>(null);

  const { data, isLoading, isLoadingError } = trpc.team.findTeamsPending.useQuery(
    {
      query: parsedSearchParams.query,
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
        header: _(msg`Team`),
        accessorKey: 'name',
        cell: ({ row }) => (
          <AvatarWithText
            avatarClass="h-12 w-12"
            avatarFallback={row.original.name.slice(0, 1).toUpperCase()}
            primaryText={
              <span className="text-foreground/80 font-semibold">{row.original.name}</span>
            }
            secondaryText={`${NEXT_PUBLIC_WEBAPP_URL()}/t/${row.original.url}`}
          />
        ),
      },
      {
        header: _(msg`Created on`),
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <UserSettingsPendingTeamsTableActions
            className="justify-end"
            pendingTeamId={row.original.id}
            onPayClick={setCheckoutPendingTeamId}
          />
        ),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, []);

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

      <TeamCheckoutCreateDialog
        pendingTeamId={checkoutPendingTeamId}
        onClose={() => setCheckoutPendingTeamId(null)}
      />
    </>
  );
};
