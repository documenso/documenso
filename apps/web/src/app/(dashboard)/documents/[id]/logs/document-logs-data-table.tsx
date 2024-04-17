'use client';

import { useSearchParams } from 'next/navigation';

import { DateTime } from 'luxon';
import type { DateTimeFormatOptions } from 'luxon';
import { UAParser } from 'ua-parser-js';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { ZBaseTableSearchParamsSchema } from '@documenso/lib/types/search-params';
import { formatDocumentAuditLogAction } from '@documenso/lib/utils/document-audit-logs';
import { trpc } from '@documenso/trpc/react';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

import { LocaleDate } from '~/components/formatter/locale-date';

export type DocumentLogsDataTableProps = {
  documentId: number;
};

const dateFormat: DateTimeFormatOptions = {
  ...DateTime.DATETIME_SHORT,
  hourCycle: 'h12',
};

export const DocumentLogsDataTable = ({ documentId }: DocumentLogsDataTableProps) => {
  const parser = new UAParser();

  const searchParams = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const parsedSearchParams = ZBaseTableSearchParamsSchema.parse(
    Object.fromEntries(searchParams ?? []),
  );

  const { data, isLoading, isInitialLoading, isLoadingError } =
    trpc.document.findDocumentAuditLogs.useQuery(
      {
        documentId,
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

  const uppercaseFistLetter = (text: string) => {
    return text.charAt(0).toUpperCase() + text.slice(1);
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
          header: 'Time',
          accessorKey: 'createdAt',
          cell: ({ row }) => <LocaleDate format={dateFormat} date={row.original.createdAt} />,
        },
        {
          header: 'User',
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
          header: 'Action',
          accessorKey: 'type',
          cell: ({ row }) => (
            <span>
              {uppercaseFistLetter(formatDocumentAuditLogAction(row.original).description)}
            </span>
          ),
        },
        {
          header: 'IP Address',
          accessorKey: 'ipAddress',
        },
        {
          header: 'Browser',
          cell: ({ row }) => {
            if (!row.original.userAgent) {
              return 'N/A';
            }

            parser.setUA(row.original.userAgent);

            const result = parser.getResult();

            return result.browser.name ?? 'N/A';
          },
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
