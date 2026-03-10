import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { AlertTriangleIcon, Loader } from 'lucide-react';
import { DateTime } from 'luxon';
import { Link, useSearchParams } from 'react-router';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { useToast } from '@documenso/ui/primitives/use-toast';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export default function AdminUnsealedDocumentsPage() {
  const { _, i18n } = useLingui();
  const { toast } = useToast();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const page = searchParams?.get?.('page') ? Number(searchParams.get('page')) : undefined;
  const perPage = searchParams?.get?.('perPage') ? Number(searchParams.get('perPage')) : undefined;

  const {
    data: findUnsealedData,
    isPending: isLoading,
    refetch,
  } = trpc.admin.document.findUnsealed.useQuery(
    {
      page: page || 1,
      perPage: perPage || 20,
    },
    {
      placeholderData: (previousData) => previousData,
    },
  );

  const { mutateAsync: resealDocument, isPending: isResealing } =
    trpc.admin.document.reseal.useMutation({
      onSuccess: () => {
        toast({ title: _(msg`Seal job triggered`), variant: 'default' });
        void refetch();
      },
      onError: () => {
        toast({ title: _(msg`Failed to trigger seal`), variant: 'destructive' });
      },
    });

  const results = findUnsealedData ?? {
    data: [],
    perPage: 20,
    currentPage: 1,
    totalPages: 1,
  };

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Title`),
        accessorKey: 'title',
        cell: ({ row }) => {
          return (
            <Link
              to={`/admin/documents/${row.original.id}`}
              className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[15rem]"
            >
              {row.original.title}
            </Link>
          );
        },
      },
      {
        header: _(msg`Owner`),
        accessorKey: 'ownerEmail',
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">
            <div>{row.original.ownerName}</div>
            <div>{row.original.ownerEmail}</div>
          </div>
        ),
      },
      {
        header: _(msg`Last Signed`),
        accessorKey: 'lastSignedAt',
        cell: ({ row }) => {
          if (!row.original.lastSignedAt) {
            return <span className="text-muted-foreground">-</span>;
          }

          return i18n.date(row.original.lastSignedAt, {
            dateStyle: 'medium',
            timeStyle: 'short',
          });
        },
      },
      {
        header: _(msg`Stuck For`),
        accessorKey: 'stuckDuration',
        cell: ({ row }) => {
          if (!row.original.lastSignedAt) {
            return <span className="text-muted-foreground">-</span>;
          }

          const signedAt = DateTime.fromJSDate(new Date(row.original.lastSignedAt));
          const stuckMs = Date.now() - signedAt.toMillis();
          const isOld = stuckMs > SIX_HOURS_MS;
          const label = signedAt.toRelative() ?? '';

          return <Badge variant={isOld ? 'destructive' : 'warning'}>{label}</Badge>;
        },
      },
      {
        header: _(msg`Created`),
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        header: _(msg`Actions`),
        accessorKey: 'actions',
        cell: ({ row }) => {
          return (
            <Button
              variant="outline"
              size="sm"
              disabled={isResealing}
              onClick={() => void resealDocument({ id: row.original.id })}
            >
              <Trans>Reseal</Trans>
            </Button>
          );
        },
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, [isResealing]);

  const onPaginationChange = (newPage: number, newPerPage: number) => {
    updateSearchParams({
      page: newPage,
      perPage: newPerPage,
    });
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <AlertTriangleIcon className="h-8 w-8 text-destructive" />
        <h2 className="text-4xl font-semibold">
          <Trans>Unsealed Documents</Trans>
        </h2>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        <Trans>
          Documents where all recipients have signed but the document has not been sealed. Documents
          stuck for more than 6 hours are no longer retried by the sweep job.
        </Trans>
      </p>

      <div className="relative mt-8">
        <DataTable
          columns={columns}
          data={results.data}
          perPage={results.perPage ?? 20}
          currentPage={results.currentPage ?? 1}
          totalPages={results.totalPages ?? 1}
          onPaginationChange={onPaginationChange}
        >
          {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
        </DataTable>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50">
            <Loader className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        )}
      </div>
    </div>
  );
}
