import { useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { trpc } from '@documenso/trpc/react';
import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Input } from '@documenso/ui/primitives/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

import { DocumentStatus } from '~/components/general/document/document-status';

export default function AdminDocumentsPage() {
  const { _, i18n } = useLingui();

  const [searchParams] = useSearchParams();

  const updateSearchParams = useUpdateSearchParams();

  const [term, setTerm] = useState(() => searchParams?.get?.('term') ?? '');
  const debouncedTerm = useDebouncedValue(term, 500);

  const page = searchParams?.get?.('page') ? Number(searchParams.get('page')) : undefined;
  const perPage = searchParams?.get?.('perPage') ? Number(searchParams.get('perPage')) : undefined;

  const { data: findDocumentsData, isPending: isFindDocumentsLoading } =
    trpc.admin.document.find.useQuery(
      {
        query: debouncedTerm,
        page: page || 1,
        perPage: perPage || 20,
      },
      {
        placeholderData: (previousData) => previousData,
      },
    );

  const results = findDocumentsData ?? {
    data: [],
    perPage: 20,
    currentPage: 1,
    totalPages: 1,
  };

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Created`),
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        header: _(msg`Title`),
        accessorKey: 'title',
        cell: ({ row }) => {
          return (
            <Link
              to={`/admin/documents/${row.original.envelopeId}`}
              className="block max-w-[5rem] truncate font-medium hover:underline md:max-w-[10rem]"
            >
              {row.original.title}
            </Link>
          );
        },
      },
      {
        header: _(msg`Status`),
        accessorKey: 'status',
        cell: ({ row }) => <DocumentStatus status={row.original.status} />,
      },
      {
        header: _(msg`Owner`),
        accessorKey: 'owner',
        cell: ({ row }) => {
          const avatarFallbackText = row.original.user.name
            ? extractInitials(row.original.user.name)
            : row.original.user.email.slice(0, 1).toUpperCase();

          return (
            <Tooltip delayDuration={200}>
              <TooltipTrigger>
                <Link to={`/admin/users/${row.original.user.id}`}>
                  <Avatar className="dark:border-border h-12 w-12 border-2 border-solid border-white">
                    <AvatarFallback className="text-muted-foreground text-xs">
                      {avatarFallbackText}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </TooltipTrigger>

              <TooltipContent className="flex max-w-xs items-center gap-2">
                <Avatar className="dark:border-border h-12 w-12 border-2 border-solid border-white">
                  <AvatarFallback className="text-muted-foreground text-xs">
                    {avatarFallbackText}
                  </AvatarFallback>
                </Avatar>

                <div className="text-muted-foreground flex flex-col text-sm">
                  <span>{row.original.user.name}</span>
                  <span>{row.original.user.email}</span>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        header: _(msg`Last updated`),
        accessorKey: 'updatedAt',
        cell: ({ row }) => i18n.date(row.original.updatedAt),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, []);

  const onPaginationChange = (newPage: number, newPerPage: number) => {
    updateSearchParams({
      page: newPage,
      perPage: newPerPage,
    });
  };

  return (
    <div>
      <h2 className="text-4xl font-semibold">
        <Trans>Manage documents</Trans>
      </h2>

      <div className="mt-8">
        <div>
          <Input
            type="search"
            placeholder={_(msg`Search by document title`)}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />

          <div className="relative mt-4">
            <DataTable
              columns={columns}
              data={results.data}
              perPage={results.perPage ?? 20}
              currentPage={results.currentPage ?? 1}
              totalPages={results.totalPages ?? 1}
              onPaginationChange={onPaginationChange}
            >
              {(table) => (
                <DataTablePagination additionalInformation="VisibleCount" table={table} />
              )}
            </DataTable>

            {isFindDocumentsLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                <Loader className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
