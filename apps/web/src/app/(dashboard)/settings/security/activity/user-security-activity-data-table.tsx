'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { DateTimeFormatOptions } from 'luxon';
import { DateTime } from 'luxon';
import { UAParser } from 'ua-parser-js';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { USER_SECURITY_AUDIT_LOG_MAP } from '@documenso/lib/constants/auth';
import { ZBaseTableSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

import { LocaleDate } from '~/components/formatter/locale-date';

const dateFormat: DateTimeFormatOptions = {
  ...DateTime.DATETIME_SHORT,
  hourCycle: 'h12',
};

export const UserSecurityActivityDataTable = () => {
  const parser = new UAParser();

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const parsedSearchParams = ZBaseTableSearchParamsSchema.parse(
    Object.fromEntries(searchParams ?? []),
  );

  const { data, isLoading, isInitialLoading, isLoadingError } =
    trpc.profile.findUserSecurityAuditLogs.useQuery(
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
          header: 'Date',
          accessorKey: 'createdAt',
          cell: ({ row }) => <LocaleDate format={dateFormat} date={row.original.createdAt} />,
        },
        {
          header: 'Device',
          cell: ({ row }) => {
            if (!row.original.userAgent) {
              return 'N/A';
            }

            parser.setUA(row.original.userAgent);

            const result = parser.getResult();

            let output = result.os.name;

            if (!output) {
              return 'N/A';
            }

            if (result.os.version) {
              output += ` (${result.os.version})`;
            }

            return output;
          },
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
        {
          header: 'IP Address',
          accessorKey: 'ipAddress',
          cell: ({ row }) => row.original.ipAddress ?? 'N/A',
        },
        {
          header: 'Action',
          accessorKey: 'type',
          cell: ({ row }) => USER_SECURITY_AUDIT_LOG_MAP[row.original.type],
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
              <Skeleton className="h-4 w-12 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-12 rounded-full" />
            </TableCell>
          </>
        ),
      }}
    >
      {(table) => <DataTablePagination table={table} />}
    </DataTable>
  );
};
