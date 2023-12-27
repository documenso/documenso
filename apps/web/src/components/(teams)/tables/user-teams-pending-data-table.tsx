'use client';

import { useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { ZBaseTableSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { LocaleDate } from '~/components/formatter/locale-date';

export default function UserTeamsPendingDataTable() {
  const searchParams = useSearchParams()!;
  const updateSearchParams = useUpdateSearchParams();

  const { toast } = useToast();

  const parsedSearchParams = ZBaseTableSearchParamsSchema.parse(
    Object.fromEntries(searchParams ?? []),
  );

  const [mutatingTeamIds, setMutatingTeamIds] = useState<{ [id: number]: 'checkout' | 'delete' }>(
    {},
  );

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

  const { mutateAsync: createTeamPendingCheckout } =
    trpc.team.createTeamPendingCheckout.useMutation({
      onSettled: (_data, _error, { pendingTeamId }) => removeIdFromMutatingTeamIds(pendingTeamId),
      onMutate: ({ pendingTeamId }) => addIdToMutatingTeamIds(pendingTeamId, 'checkout'),
      onSuccess: (checkoutUrl) => window.open(checkoutUrl, '_blank'),
    });

  const { mutateAsync: deleteTeamPending } = trpc.team.deleteTeamPending.useMutation({
    onSettled: (_data, _error, { pendingTeamId }) => removeIdFromMutatingTeamIds(pendingTeamId),
    onMutate: ({ pendingTeamId }) => addIdToMutatingTeamIds(pendingTeamId, 'delete'),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Pending team deleted.',
      });
    },
    onError: () => {
      toast({
        title: 'Something went wrong',
        description:
          'We encountered an unknown error while attempting to delete the pending team. Please try again later.',
        duration: 10000,
        variant: 'destructive',
      });
    },
  });

  const onPaginationChange = (page: number, perPage: number) => {
    updateSearchParams({
      page,
      perPage,
    });
  };

  const addIdToMutatingTeamIds = (pendingTeamId: number, type: 'checkout' | 'delete') => {
    setMutatingTeamIds((prev) => ({
      ...prev,
      [pendingTeamId]: type,
    }));
  };

  const removeIdFromMutatingTeamIds = (pendingTeamId: number) => {
    setMutatingTeamIds((prev) => {
      const ids = { ...prev };
      delete ids[pendingTeamId];
      return ids;
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
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                disabled={Boolean(mutatingTeamIds[row.original.id])}
                loading={mutatingTeamIds[row.original.id] === 'checkout'}
                onClick={async () => createTeamPendingCheckout({ pendingTeamId: row.original.id })}
              >
                Pay
              </Button>

              <Button
                variant="destructive"
                disabled={Boolean(mutatingTeamIds[row.original.id])}
                loading={mutatingTeamIds[row.original.id] === 'delete'}
                onClick={async () => deleteTeamPending({ pendingTeamId: row.original.id })}
              >
                Remove
              </Button>
            </div>
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
  );
}
