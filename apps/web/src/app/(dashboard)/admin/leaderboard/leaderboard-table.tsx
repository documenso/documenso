'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { ChevronDownIcon as CaretSortIcon, Loader } from 'lucide-react';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Input } from '@documenso/ui/primitives/input';

export type SigningVolume = {
  customer_id: number;
  customer_type: 'User' | 'Team';
  customer_created_at: Date;
  total_documents: bigint;
  completed_documents: bigint;
  customer_email: string;
  customer_name: string;
};

type LeaderboardTableProps = {
  signingVolume: SigningVolume[];
  totalPages: number;
  perPage: number;
  page: number;
};

export const LeaderboardTable = ({
  signingVolume,
  totalPages,
  perPage,
  page,
}: LeaderboardTableProps) => {
  const { _ } = useLingui();

  const [isPending, startTransition] = useTransition();
  const updateSearchParams = useUpdateSearchParams();
  const [searchString, setSearchString] = useState('');
  const debouncedSearchString = useDebouncedValue(searchString, 1000);

  const columns = useMemo(() => {
    return [
      {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {_(msg`Name`)}
            <CaretSortIcon className="ml-2 h-4 w-4" />
          </Button>
        ),
        accessorKey: 'customer_name',
        cell: ({ row }) => <div>{row.getValue('customer_name')}</div>,
      },
      {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {_(msg`Email`)}
            <CaretSortIcon className="ml-2 h-4 w-4" />
          </Button>
        ),
        accessorKey: 'customer_email',
        cell: ({ row }) => <div>{row.getValue('customer_email')}</div>,
      },
      {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {_(msg`Signing Volume`)}
            <CaretSortIcon className="ml-2 h-4 w-4" />
          </Button>
        ),
        accessorKey: 'completed_documents',
        cell: ({ row }) => <div>{Number(row.getValue('completed_documents'))}</div>,
      },
      {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {_(msg`Customer Type`)}
            <CaretSortIcon className="ml-2 h-4 w-4" />
          </Button>
        ),
        accessorKey: 'customer_type',
        cell: ({ row }) => <div>{row.getValue('customer_type')}</div>,
      },
    ] satisfies DataTableColumnDef<SigningVolume>[];
  }, []);

  useEffect(() => {
    startTransition(() => {
      updateSearchParams({
        search: debouncedSearchString,
        page: 1,
        perPage,
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
