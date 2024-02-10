'use client';

import Link from 'next/link';

import { File } from 'lucide-react';
import { DateTime } from 'luxon';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

export type TeamBillingInvoicesDataTableProps = {
  teamId: number;
};

export const TeamBillingInvoicesDataTable = ({ teamId }: TeamBillingInvoicesDataTableProps) => {
  const { data, isLoading, isInitialLoading, isLoadingError } = trpc.team.findTeamInvoices.useQuery(
    {
      teamId,
    },
    {
      keepPreviousData: true,
    },
  );

  const formatCurrency = (currency: string, amount: number) => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    });

    return formatter.format(amount);
  };

  const results = {
    data: data?.data ?? [],
    perPage: 100,
    currentPage: 1,
    totalPages: 1,
  };

  return (
    <DataTable
      columns={[
        {
          header: 'Invoice',
          accessorKey: 'created',
          cell: ({ row }) => (
            <div className="flex max-w-xs items-center gap-2">
              <File className="h-6 w-6" />

              <div className="flex flex-col text-sm">
                <span className="text-foreground/80 font-semibold">
                  {DateTime.fromSeconds(row.original.created).toFormat('MMMM yyyy')}
                </span>
                <span className="text-muted-foreground">
                  {row.original.quantity} {row.original.quantity > 1 ? 'Seats' : 'Seat'}
                </span>
              </div>
            </div>
          ),
        },
        {
          header: 'Status',
          accessorKey: 'status',
          cell: ({ row }) => {
            const { status, paid } = row.original;

            if (!status) {
              return paid ? 'Paid' : 'Unpaid';
            }

            return status.charAt(0).toUpperCase() + status.slice(1);
          },
        },
        {
          header: 'Amount',
          accessorKey: 'total',
          cell: ({ row }) => formatCurrency(row.original.currency, row.original.total / 100),
        },
        {
          id: 'actions',
          cell: ({ row }) => (
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                asChild
                disabled={typeof row.original.hostedInvoicePdf !== 'string'}
              >
                <Link href={row.original.hostedInvoicePdf ?? ''} target="_blank">
                  View
                </Link>
              </Button>

              <Button
                variant="outline"
                asChild
                disabled={typeof row.original.hostedInvoicePdf !== 'string'}
              >
                <Link href={row.original.invoicePdf ?? ''} target="_blank">
                  Download
                </Link>
              </Button>
            </div>
          ),
        },
      ]}
      data={results.data}
      perPage={results.perPage}
      currentPage={results.currentPage}
      totalPages={results.totalPages}
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
                <Skeleton className="h-7 w-7 flex-shrink-0 rounded" />

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
              <Skeleton className="h-4 w-20 rounded-full" />
            </TableCell>
            <TableCell>
              <div className="flex flex-row justify-end space-x-2">
                <Skeleton className="h-10 w-20 rounded" />
                <Skeleton className="h-10 w-16 rounded" />
              </div>
            </TableCell>
          </>
        ),
      }}
    >
      {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
    </DataTable>
  );
};
