'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Loader } from 'lucide-react';

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

import { DocumentStatus } from '~/components/formatter/document-status';

// export type AdminDocumentResultsProps = {};

export const AdminDocumentResults = () => {
  const { _, i18n } = useLingui();

  const searchParams = useSearchParams();

  const updateSearchParams = useUpdateSearchParams();

  const [term, setTerm] = useState(() => searchParams?.get?.('term') ?? '');
  const debouncedTerm = useDebouncedValue(term, 500);

  const page = searchParams?.get?.('page') ? Number(searchParams.get('page')) : undefined;
  const perPage = searchParams?.get?.('perPage') ? Number(searchParams.get('perPage')) : undefined;

  const { data: findDocumentsData, isLoading: isFindDocumentsLoading } =
    trpc.admin.findDocuments.useQuery(
      {
        query: debouncedTerm,
        page: page || 1,
        perPage: perPage || 20,
      },
      {
        keepPreviousData: true,
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
              href={`/admin/documents/${row.original.id}`}
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
          const avatarFallbackText = row.original.User.name
            ? extractInitials(row.original.User.name)
            : row.original.User.email.slice(0, 1).toUpperCase();

          return (
            <Tooltip delayDuration={200}>
              <TooltipTrigger>
                <Link href={`/admin/users/${row.original.User.id}`}>
                  <Avatar className="dark:border-border h-12 w-12 border-2 border-solid border-white">
                    <AvatarFallback className="text-xs text-gray-400">
                      {avatarFallbackText}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </TooltipTrigger>

              <TooltipContent className="flex max-w-xs items-center gap-2">
                <Avatar className="dark:border-border h-12 w-12 border-2 border-solid border-white">
                  <AvatarFallback className="text-xs text-gray-400">
                    {avatarFallbackText}
                  </AvatarFallback>
                </Avatar>

                <div className="text-muted-foreground flex flex-col text-sm">
                  <span>{row.original.User.name}</span>
                  <span>{row.original.User.email}</span>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        header: 'Last updated',
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
          {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
        </DataTable>

        {isFindDocumentsLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50">
            <Loader className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        )}
      </div>
    </div>
  );
};
