import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { Trans, useLingui } from '@lingui/react/macro';
import { EditIcon, MoreHorizontalIcon, SendIcon, Trash2Icon } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { EmailTransportDeleteDialog } from '../dialogs/email-transport-delete-dialog';
import { EmailTransportSendTestDialog } from '../dialogs/email-transport-send-test-dialog';
import { EmailTransportUpdateDialog } from '../dialogs/email-transport-update-dialog';

export const AdminEmailTransportsTable = () => {
  const { t, i18n } = useLingui();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const parsedSearchParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));

  const { data, isLoading, isLoadingError } = trpc.admin.emailTransport.find.useQuery({
    query: parsedSearchParams.query,
    page: parsedSearchParams.page,
    perPage: parsedSearchParams.perPage,
  });

  const onPaginationChange = (page: number, perPage: number) => {
    updateSearchParams({
      page,
      perPage,
    });
  };

  const results = data ?? {
    data: [],
    perPage: 20,
    currentPage: 1,
    totalPages: 1,
  };

  const columns = useMemo(() => {
    return [
      {
        header: t`Name`,
        accessorKey: 'name',
      },
      {
        header: t`Type`,
        accessorKey: 'type',
      },
      {
        header: t`From`,
        cell: ({ row }) => `${row.original.fromName} <${row.original.fromAddress}>`,
      },
      {
        header: t`Used by claims`,
        cell: ({ row }) => row.original._count.subscriptionClaims + row.original._count.organisationClaims,
      },
      {
        header: t`Created`,
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <MoreHorizontalIcon className="h-5 w-5 text-muted-foreground" />
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-52" align="start" forceMount>
              <DropdownMenuLabel>
                <Trans>Actions</Trans>
              </DropdownMenuLabel>

              <EmailTransportUpdateDialog
                transport={row.original}
                trigger={
                  <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                    <div>
                      <EditIcon className="mr-2 h-4 w-4" />
                      <Trans>Edit</Trans>
                    </div>
                  </DropdownMenuItem>
                }
              />

              <EmailTransportSendTestDialog
                transportId={row.original.id}
                trigger={
                  <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                    <div>
                      <SendIcon className="mr-2 h-4 w-4" />
                      <Trans>Send test</Trans>
                    </div>
                  </DropdownMenuItem>
                }
              />

              <EmailTransportDeleteDialog
                transportId={row.original.id}
                transportName={row.original.name}
                subscriptionClaimCount={row.original._count.subscriptionClaims}
                organisationClaimCount={row.original._count.organisationClaims}
                trigger={
                  <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                    <div>
                      <Trash2Icon className="mr-2 h-4 w-4" />
                      <Trans>Delete</Trans>
                    </div>
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, []);

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
          rows: 3,
          component: (
            <>
              <TableCell className="py-4 pr-4">
                <Skeleton className="h-4 w-24 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20 rounded-full" />
              </TableCell>
              <TableCell>
                <div className="flex flex-row justify-end space-x-2">
                  <Skeleton className="h-2 w-6 rounded" />
                </div>
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
