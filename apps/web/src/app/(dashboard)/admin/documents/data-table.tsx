'use client';

import { useTransition } from 'react';

import Link from 'next/link';

import { Edit, Loader } from 'lucide-react';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { FindResultSet } from '@documenso/lib/types/find-result-set';
import { Document, User } from '@documenso/prisma/client';
import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';

import { DocumentStatus } from '~/components/formatter/document-status';
import { LocaleDate } from '~/components/formatter/locale-date';

import { DataTableActionDropdown } from './data-table-action-dropdown';

export type DocumentsDataTableProps = {
  results: FindResultSet<
    Document & {
      User: Pick<User, 'id' | 'name' | 'email'>;
    }
  >;
};

export const DocumentsDataTable = ({ results }: DocumentsDataTableProps) => {
  const [isPending, startTransition] = useTransition();

  const updateSearchParams = useUpdateSearchParams();

  const onPaginationChange = (page: number, perPage: number) => {
    startTransition(() => {
      updateSearchParams({
        page,
        perPage,
      });
    });
  };

  return (
    <div className="relative">
      <DataTable
        columns={[
          {
            header: 'Created',
            accessorKey: 'createdAt',
            cell: ({ row }) => <LocaleDate date={row.original.createdAt} />,
          },
          {
            header: 'Title',
            accessorKey: 'title',
            cell: ({ row }) => {
              return (
                <Link
                  title={row.original.title}
                  className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[20rem]"
                  href={{
                    pathname: `/admin/documents/${row.original.id}`,
                    query: {
                      userId: row.original.User.id,
                      documentId: row.original.id,
                    },
                  }}
                >
                  {row.original.title}
                </Link>
              );
            },
          },
          {
            header: 'Owner',
            accessorKey: 'owner',
            cell: ({ row }) => {
              return (
                <Link href={`/admin/users/${row.original.User.id}`}>
                  <Avatar className="dark:border-border h-12 w-12 border-2 border-solid border-white">
                    <AvatarFallback className="text-gray-400">
                      <span className="text-xs">{row.original.User.name}</span>
                    </AvatarFallback>
                  </Avatar>
                </Link>
              );
            },
          },
          {
            header: 'Status',
            accessorKey: 'status',
            cell: ({ row }) => <DocumentStatus status={row.original.status} />,
          },
          {
            header: 'Actions',
            cell: ({ row }) => (
              <div className="flex items-center gap-x-4">
                <Button className="w-24" asChild>
                  <Link href={`/documents/${row.original.id}`}>
                    <Edit className="-ml-1 mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
                <DataTableActionDropdown row={row.original} />
              </div>
            ),
          },
        ]}
        data={results.data}
        perPage={results.perPage}
        currentPage={results.currentPage}
        totalPages={results.totalPages}
        onPaginationChange={onPaginationChange}
      >
        {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
      </DataTable>

      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      )}
    </div>
  );
};
