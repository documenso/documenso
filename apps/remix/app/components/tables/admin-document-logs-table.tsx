import { useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DateTime } from 'luxon';
import type { DateTimeFormatOptions } from 'luxon';
import { useSearchParams } from 'react-router';
import { UAParser } from 'ua-parser-js';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import type { TDocumentAuditLog } from '@documenso/lib/types/document-audit-logs';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { formatDocumentAuditLogAction } from '@documenso/lib/utils/document-audit-logs';
import { trpc } from '@documenso/trpc/react';
import { CopyTextButton } from '@documenso/ui/components/common/copy-text-button';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@documenso/ui/primitives/dialog';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type AdminDocumentLogsTableProps = {
  envelopeId: string;
};

const dateFormat: DateTimeFormatOptions = {
  ...DateTime.DATETIME_SHORT,
  hourCycle: 'h12',
};

export const AdminDocumentLogsTable = ({ envelopeId }: AdminDocumentLogsTableProps) => {
  const { _, i18n } = useLingui();
  const { toast } = useToast();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const [selectedAuditLog, setSelectedAuditLog] = useState<TDocumentAuditLog | null>(null);

  const parsedSearchParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));

  const { data, isLoading, isLoadingError } = trpc.admin.document.findAuditLogs.useQuery(
    {
      envelopeId,
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
        cell: ({ row }) => (
          <span>{formatDocumentAuditLogAction(i18n, row.original).description}</span>
        ),
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
      {
        header: '',
        id: 'actions',
        cell: ({ row }) => (
          <Button variant="link" size="sm" onClick={() => setSelectedAuditLog(row.original)}>
            <Trans>View JSON</Trans>
          </Button>
        ),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, []);

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
              <TableCell>
                <Skeleton className="h-4 w-8 rounded-full" />
              </TableCell>
            </>
          ),
        }}
      >
        {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
      </DataTable>

      <Dialog open={selectedAuditLog !== null} onOpenChange={() => setSelectedAuditLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              <Trans>Audit Log Details</Trans>
            </DialogTitle>
          </DialogHeader>

          {selectedAuditLog && (
            <div className="group relative">
              <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                <CopyTextButton
                  value={JSON.stringify(selectedAuditLog, null, 2)}
                  onCopySuccess={() => toast({ title: _(msg`Copied to clipboard`) })}
                />
              </div>

              <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-muted/50 p-4 font-mono text-xs leading-relaxed text-foreground">
                {JSON.stringify(selectedAuditLog, null, 2)}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
