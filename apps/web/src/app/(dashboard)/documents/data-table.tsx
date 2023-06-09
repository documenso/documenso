'use client';

import { useTransition } from 'react';

import Link from 'next/link';

import { Loader } from 'lucide-react';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { FindResultSet } from '@documenso/lib/types/find-result-set';
import { Document } from '@documenso/prisma/client';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';

import { DocumentStatus } from '~/components/formatter/document-status';
import { LocaleDate } from '~/components/formatter/locale-date';

export type DocumentsDataTableProps = {
  results: FindResultSet<Document>;
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
            header: 'ID',
            accessorKey: 'id',
          },
          {
            header: 'Title',
            cell: ({ row }) => (
              <Link href={`/documents/${row.original.id}`} className="font-medium hover:underline">
                {row.original.title}
              </Link>
            ),
          },
          {
            header: 'Status',
            accessorKey: 'status',
            cell: ({ row }) => <DocumentStatus status={row.getValue('status')} />,
          },
          {
            header: 'Created',
            accessorKey: 'created',
            cell: ({ row }) => <LocaleDate date={row.getValue('created')} />,
          },
        ]}
        data={results.data}
        perPage={results.perPage}
        currentPage={results.currentPage}
        totalPages={results.totalPages}
        onPaginationChange={onPaginationChange}
      >
        {(table) => <DataTablePagination table={table} />}
      </DataTable>

      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      )}
    </div>
  );
};
