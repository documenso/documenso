'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { ChevronDownIcon as CaretSortIcon, Loader } from 'lucide-react';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Input } from '@documenso/ui/primitives/input';

export type SigningVolume = {
  id: number;
  name: string;
  signingVolume: number;
  createdAt: Date;
  planId: string;
};

type LeaderboardTableProps = {
  signingVolume: SigningVolume[];
  totalPages: number;
  perPage: number;
  page: number;
  sortBy: 'name' | 'createdAt' | 'signingVolume';
  sortOrder: 'asc' | 'desc';
};

export const LeaderboardTable = ({
  signingVolume,
  totalPages,
  perPage,
  page,
  sortBy,
  sortOrder,
}: LeaderboardTableProps) => {
  const { _, i18n } = useLingui();

  const [isPending, startTransition] = useTransition();
  const updateSearchParams = useUpdateSearchParams();
  const [searchString, setSearchString] = useState('');
  const debouncedSearchString = useDebouncedValue(searchString, 1000);

  const columns = useMemo(() => {
    return [
      {
        header: () => (
          <div
            className="flex cursor-pointer items-center"
            onClick={() => handleColumnSort('name')}
          >
            {_(msg`Name`)}
            <CaretSortIcon className="ml-2 h-4 w-4" />
          </div>
        ),
        accessorKey: 'name',
        cell: ({ row }) => {
          return (
            <div>
              <a
                className="text-primary underline"
                href={`https://dashboard.stripe.com/subscriptions/${row.original.planId}`}
                target="_blank"
              >
                {row.getValue('name')}
              </a>
            </div>
          );
        },
        size: 250,
      },
      {
        header: () => (
          <div
            className="flex cursor-pointer items-center"
            onClick={() => handleColumnSort('signingVolume')}
          >
            {_(msg`Signing Volume`)}
            <CaretSortIcon className="ml-2 h-4 w-4" />
          </div>
        ),
        accessorKey: 'signingVolume',
        cell: ({ row }) => <div>{Number(row.getValue('signingVolume'))}</div>,
      },
      {
        header: () => {
          return (
            <div
              className="flex cursor-pointer items-center"
              onClick={() => handleColumnSort('createdAt')}
            >
              {_(msg`Created`)}
              <CaretSortIcon className="ml-2 h-4 w-4" />
            </div>
          );
        },
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
    ] satisfies DataTableColumnDef<SigningVolume>[];
  }, [sortOrder]);

  useEffect(() => {
    startTransition(() => {
      updateSearchParams({
        search: debouncedSearchString,
        page: 1,
        perPage,
        sortBy,
        sortOrder,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchString]);

  const onPaginationChange = (page: number, perPage: number) => {
    startTransition(() => {
      updateSearchParams({
        page,
        perPage,
      });
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchString(e.target.value);
  };

  const handleColumnSort = (column: 'name' | 'createdAt' | 'signingVolume') => {
    startTransition(() => {
      updateSearchParams({
        sortBy: column,
        sortOrder: sortOrder === 'asc' ? 'desc' : 'asc',
      });
    });
  };

  return (
    <div className="relative">
      <Input
        className="my-6 flex flex-row gap-4"
        type="text"
        placeholder={_(msg`Search by name or email`)}
        value={searchString}
        onChange={handleChange}
      />
      <DataTable
        columns={columns}
        data={signingVolume}
        perPage={perPage}
        currentPage={page}
        totalPages={totalPages}
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
