import type { DocumentInsights } from '@documenso/lib/server-only/admin/get-organisation-detailed-insights';
import type { DateRange } from '@documenso/lib/types/search-params';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { DataTable, type DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { DocumentStatus } from '~/components/general/document/document-status';
import { useAdminOrganisationInsights } from '~/components/general/use-admin-organisation-insights';

type AdminOrganisationDocumentsTableProps = {
  organisationId: string;
};

export const AdminOrganisationDocumentsTable = ({ organisationId }: AdminOrganisationDocumentsTableProps) => {
  const { t, i18n } = useLingui();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [dateRange, setDateRange] = useState<DateRange>('allTime');

  const { insights, isLoading } = useAdminOrganisationInsights({
    organisationId,
    view: 'documents',
    page,
    perPage,
    dateRange,
  });

  const columns = useMemo(() => {
    return [
      {
        header: t`Title`,
        accessorKey: 'title',
        cell: ({ row }) => (
          <Link
            className="block max-w-[300px] truncate font-medium hover:underline"
            to={`/admin/documents/${row.original.id}`}
            title={row.original.title}
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        header: t`Status`,
        accessorKey: 'status',
        cell: ({ row }) => <DocumentStatus status={row.original.status} />,
      },
      {
        header: t`Team`,
        accessorKey: 'teamName',
        cell: ({ row }) => (
          <span className="block max-w-[160px] truncate text-muted-foreground" title={row.original.teamName}>
            {row.original.teamName}
          </span>
        ),
      },
      {
        header: t`Created`,
        accessorKey: 'createdAt',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {i18n.date(row.original.createdAt, { dateStyle: 'medium' })}
          </span>
        ),
      },
      {
        header: t`Completed`,
        accessorKey: 'completedAt',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {row.original.completedAt ? i18n.date(row.original.completedAt, { dateStyle: 'medium' }) : '–'}
          </span>
        ),
      },
    ] satisfies DataTableColumnDef<DocumentInsights>[];
  }, [i18n, t]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Select
          value={dateRange}
          onValueChange={(range: DateRange) => {
            setDateRange(range);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-40" aria-label={t`Created in`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {t(label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* The previous page stays on screen, dimmed, until the next one arrives, so the table does not jump. */}
      <div className={cn(isLoading && insights && 'opacity-60')}>
        <DataTable
          columns={columns}
          data={insights?.documents ?? []}
          perPage={perPage}
          currentPage={page}
          totalPages={insights?.totalPages ?? 1}
          onPaginationChange={(nextPage, nextPerPage) => {
            setPage(nextPage);
            setPerPage(nextPerPage);
          }}
          skeleton={{
            enable: !insights,
            rows: perPage,
            component: (
              <>
                {columns.map((column) => (
                  <TableCell key={column.accessorKey}>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                ))}
              </>
            ),
          }}
          emptyState={
            <div className="flex flex-col items-center gap-2 py-6">
              <p className="font-medium text-foreground text-sm">
                {dateRange === 'allTime' ? (
                  <Trans>No documents yet</Trans>
                ) : (
                  <Trans>No documents were created in this period</Trans>
                )}
              </p>

              {dateRange === 'allTime' ? (
                <p className="text-muted-foreground text-sm">
                  <Trans>Documents created by the teams of this organisation appear here.</Trans>
                </p>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setDateRange('allTime')}>
                  <Trans>Show all time</Trans>
                </Button>
              )}
            </div>
          }
        >
          {(table) =>
            table.getPageCount() > 1 || perPage > 10 ? (
              <DataTablePagination additionalInformation="None" table={table} />
            ) : null
          }
        </DataTable>
      </div>
    </div>
  );
};

const DATE_RANGES: { value: DateRange; label: MessageDescriptor }[] = [
  { value: 'last30days', label: msg`Last 30 Days` },
  { value: 'last90days', label: msg`Last 90 Days` },
  { value: 'lastYear', label: msg`Last Year` },
  { value: 'allTime', label: msg`All Time` },
];
