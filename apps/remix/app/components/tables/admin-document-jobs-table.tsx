import { useMemo } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { useSearchParams } from 'react-router';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

export const AdminDocumentJobsTable = ({ envelopeId }: { envelopeId: string }) => {
  const { t, i18n } = useLingui();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const parsedSearchParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));

  const { data, isLoading, isLoadingError, refetch, isFetching } =
    trpc.admin.document.findJobs.useQuery({
      envelopeId: envelopeId,
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
    perPage: 10,
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
        header: t`Status`,
        accessorKey: 'status',
      },
      {
        header: t`Submitted`,
        accessorKey: 'submittedAt',
        cell: ({ row }) => i18n.date(row.original.submittedAt),
      },
      {
        header: t`Retried`,
        accessorKey: 'retried',
      },
      {
        header: t`Last Retried`,
        accessorKey: 'lastRetriedAt',
        cell: ({ row }) =>
          row.original.lastRetriedAt ? i18n.date(row.original.lastRetriedAt) : 'N/A',
      },
      {
        header: t`Completed`,
        accessorKey: 'completedAt',
        cell: ({ row }) => (row.original.completedAt ? i18n.date(row.original.completedAt) : 'N/A'),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          <Trans>Background Jobs</Trans>
        </h2>

        <Button variant="outline" size="sm" loading={isFetching} onClick={async () => refetch()}>
          <Trans>Reload</Trans>
        </Button>
      </div>

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
                <Skeleton className="h-4 w-20 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded-full" />
              </TableCell>
            </>
          ),
        }}
      >
        {(table) =>
          results.totalPages > 1 && (
            <DataTablePagination additionalInformation="VisibleCount" table={table} />
          )
        }
      </DataTable>
    </div>
  );
};
