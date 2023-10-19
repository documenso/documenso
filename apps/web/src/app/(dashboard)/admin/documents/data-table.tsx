'use client';

import { useTransition } from 'react';

import Link from 'next/link';

import { Loader } from 'lucide-react';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { FindResultSet } from '@documenso/lib/types/find-result-set';
import { recipientInitials } from '@documenso/lib/utils/recipient-formatter';
import { Document, User } from '@documenso/prisma/client';
import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

import { DocumentStatus } from '~/components/formatter/document-status';
import { LocaleDate } from '~/components/formatter/locale-date';

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
                <div className="block max-w-[5rem] truncate font-medium md:max-w-[10rem]">
                  {row.original.title}
                </div>
              );
            },
          },
          {
            header: 'Owner',
            accessorKey: 'owner',
            cell: ({ row }) => {
              const avatarFallbackText = row.original.User.name
                ? recipientInitials(row.original.User.name)
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
            cell: ({ row }) => <LocaleDate date={row.original.updatedAt} />,
          },
          {
            header: 'Status',
            accessorKey: 'status',
            cell: ({ row }) => <DocumentStatus status={row.original.status} />,
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
