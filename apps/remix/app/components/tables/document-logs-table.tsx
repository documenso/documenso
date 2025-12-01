import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { DateTime } from 'luxon';
import type { DateTimeFormatOptions } from 'luxon';
import { useSearchParams } from 'react-router';
import { UAParser } from 'ua-parser-js';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { formatDocumentAuditLogAction } from '@documenso/lib/utils/document-audit-logs';
import { trpc } from '@documenso/trpc/react';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

export type DocumentLogsTableProps = {
  documentId: number;
};

const dateFormat: DateTimeFormatOptions = {
  ...DateTime.DATETIME_SHORT,
  hourCycle: 'h12',
};

export const DocumentLogsTable = ({ documentId }: DocumentLogsTableProps) => {
  const { _, i18n } = useLingui();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const parsedSearchParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));

  const { data, isLoading, isLoadingError } = trpc.document.auditLog.find.useQuery(
    {
      documentId,
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
    const parser = new UAParser();

    return [
      {
        header: _(msg`Time`),
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt, dateFormat),
      },
      {
        header: _(msg`User`),
        accessorKey: 'name',
        cell: ({ row }) =>
          row.original.name || row.original.email ? (
            <div>
              {row.original.name && (
                <p className="truncate" title={row.original.name}>
                  {row.original.name}
                </p>
              )}

              {row.original.email && (
                <p className="truncate" title={row.original.email}>
                  {row.original.email}
                </p>
              )}
            </div>
          ) : (
            <p>N/A</p>
          ),
      },
      {
        header: _(msg`Action`),
        accessorKey: 'type',
        cell: ({ row }) => <span>{formatDocumentAuditLogAction(_, row.original).description}</span>,
      },
      {
        header: _(msg`IP Address`),
        accessorKey: 'ipAddress',
      },
      {
        header: _(msg`Browser`),
        cell: ({ row }) => {
          if (!row.original.userAgent) {
            return 'N/A';
          }

          parser.setUA(row.original.userAgent);

          const result = parser.getResult();

          return result.browser.name ?? 'N/A';
        },
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
      error={{
        enable: isLoadingError,
      }}
      skeleton={{
        enable: isLoading,
        rows: 3,
        component: (
          <>
            <TableCell>
              <Skeleton className="h-4 w-12 rounded-full" />
            </TableCell>
            <TableCell className="w-1/2 py-4 pr-4">
              <div className="ml-2 flex flex-grow flex-col">
                <Skeleton className="h-4 w-1/3 max-w-[8rem]" />
                <Skeleton className="mt-1 h-4 w-1/2 max-w-[12rem]" />
              </div>
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-12 rounded-full" />
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
  );
};
