'use client';

import { useTransition } from 'react';

import { Loader } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { FindResultSet } from '@documenso/lib/types/find-result-set';
import { Document, Recipient, User } from '@documenso/prisma/client';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';

import { StackAvatarsWithTooltip } from '~/components/(dashboard)/avatar/stack-avatars-with-tooltip';
import { DocumentStatus } from '~/components/formatter/document-status';
import { LocaleDate } from '~/components/formatter/locale-date';

import { DataTableActionButton } from './data-table-action-button';
import { DataTableActionDropdown } from './data-table-action-dropdown';
import { DataTableTitle } from './data-table-title';

export type DocumentsDataTableProps = {
  results: FindResultSet<
    Document & {
      Recipient: Recipient[];
      User: Pick<User, 'id' | 'name' | 'email'>;
    }
  >;
};

export const DocumentsDataTable = ({ results }: DocumentsDataTableProps) => {
  const { data: session } = useSession();
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

  if (!session) {
    return null;
  }

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
            cell: ({ row }) => <DataTableTitle row={row.original} />,
          },
          {
            header: 'Recipient',
            accessorKey: 'recipient',
            cell: ({ row }) => {
              return <StackAvatarsWithTooltip recipients={row.original.Recipient} />;
            },
          },
          {
            header: 'Status',
            accessorKey: 'status',
            cell: ({ row }) => <DocumentStatus status={row.getValue('status')} />,
          },
          {
            header: 'Actions',
            cell: ({ row }) => (
              <div className="flex items-center gap-x-4">
                <DataTableActionButton row={row.original} />
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
        <div className="bg-background/50 absolute inset-0 flex items-center justify-center">
          <Loader className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      )}
    </div>
  );
};
