import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { File } from 'lucide-react';
import { DateTime } from 'luxon';
import { Link } from 'react-router';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

export type OrganisationBillingInvoicesTableProps = {
  organisationId: string;
  subscriptionExists: boolean;
};

export const OrganisationBillingInvoicesTable = ({
  organisationId,
  subscriptionExists,
}: OrganisationBillingInvoicesTableProps) => {
  const { _ } = useLingui();

  const { data, isLoading, isLoadingError } = trpc.billing.invoices.get.useQuery(
    {
      organisationId,
    },
    {
      placeholderData: (previousData) => previousData,
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
    data: data || [],
    perPage: 100,
    currentPage: 1,
    totalPages: 1,
  };

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Invoice`),
        accessorKey: 'created',
        cell: ({ row }) => (
          <div className="flex max-w-xs items-center gap-2">
            <File className="h-6 w-6" />

            <div className="text-foreground/80 text-sm font-semibold">
              {DateTime.fromSeconds(row.original.created).toFormat('MMMM yyyy')}
            </div>
          </div>
        ),
      },
      {
        header: _(msg`Status`),
        accessorKey: 'status',
        cell: ({ row }) => {
          const { status } = row.original;

          if (!status) {
            return 'N/A';
          }

          return status.charAt(0).toUpperCase() + status.slice(1);
        },
      },
      {
        header: _(msg`Amount`),
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
              disabled={typeof row.original.hosted_invoice_url !== 'string'}
            >
              <Link to={row.original.hosted_invoice_url ?? ''} target="_blank">
                <Trans>View</Trans>
              </Link>
            </Button>

            <Button
              variant="outline"
              asChild
              disabled={typeof row.original.invoice_pdf !== 'string'}
            >
              <Link to={row.original.invoice_pdf ?? ''} target="_blank">
                <Trans>Download</Trans>
              </Link>
            </Button>
          </div>
        ),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, []);

  if (results.data.length === 0 && !subscriptionExists) {
    return null;
  }

  return (
    <DataTable
      columns={columns}
      data={results.data}
      perPage={results.perPage}
      currentPage={results.currentPage}
      totalPages={results.totalPages}
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
      {/* {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />} */}
    </DataTable>
  );
};
