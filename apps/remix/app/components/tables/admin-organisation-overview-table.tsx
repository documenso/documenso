import { useEffect, useMemo, useState, useTransition } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDown, Loader } from 'lucide-react';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Input } from '@documenso/ui/primitives/input';

export type OrganisationOverview = {
  id: string;
  name: string;
  signingVolume: number;
  createdAt: Date;
  planId: string;
  subscriptionStatus?: string;
  isActive?: boolean;
  teamCount?: number;
  memberCount?: number;
};

type OrganisationOverviewTableProps = {
  organisations: OrganisationOverview[];
  totalPages: number;
  perPage: number;
  page: number;
  sortBy: 'name' | 'createdAt' | 'signingVolume';
  sortOrder: 'asc' | 'desc';
};

export const AdminOrganisationOverviewTable = ({
  organisations,
  totalPages,
  perPage,
  page,
  sortBy,
  sortOrder,
}: OrganisationOverviewTableProps) => {
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
            {sortBy === 'name' ? (
              sortOrder === 'asc' ? (
                <ChevronUpIcon className="ml-2 h-4 w-4" />
              ) : (
                <ChevronDownIcon className="ml-2 h-4 w-4" />
              )
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4" />
            )}
          </div>
        ),
        accessorKey: 'name',
        cell: ({ row }) => {
          return (
            <div>
              <a
                className="text-primary underline"
                href={`/admin/organisation-insights/${row.original.id}`}
              >
                {row.getValue('name')}
              </a>
            </div>
          );
        },
        size: 200,
      },
      {
        header: () => (
          <div
            className="flex cursor-pointer items-center"
            onClick={() => handleColumnSort('signingVolume')}
          >
            {_(msg`Document Volume`)}
            {sortBy === 'signingVolume' ? (
              sortOrder === 'asc' ? (
                <ChevronUpIcon className="ml-2 h-4 w-4" />
              ) : (
                <ChevronDownIcon className="ml-2 h-4 w-4" />
              )
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4" />
            )}
          </div>
        ),
        accessorKey: 'signingVolume',
        cell: ({ row }) => <div>{Number(row.getValue('signingVolume'))}</div>,
        size: 120,
      },
      {
        header: () => {
          return <div>{_(msg`Status`)}</div>;
        },
        accessorKey: 'subscriptionStatus',
        cell: ({ row }) => {
          const status = row.original.subscriptionStatus;
          return (
            <div
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                status ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {status || 'Free'}
            </div>
          );
        },
        size: 100,
      },
      {
        header: () => {
          return <div>{_(msg`Teams`)}</div>;
        },
        accessorKey: 'teamCount',
        cell: ({ row }) => <div>{Number(row.original.teamCount) || 0}</div>,
        size: 80,
      },
      {
        header: () => {
          return <div>{_(msg`Members`)}</div>;
        },
        accessorKey: 'memberCount',
        cell: ({ row }) => <div>{Number(row.original.memberCount) || 0}</div>,
        size: 80,
      },
      {
        header: () => {
          return (
            <div
              className="flex cursor-pointer items-center"
              onClick={() => handleColumnSort('createdAt')}
            >
              {_(msg`Created`)}
              {sortBy === 'createdAt' ? (
                sortOrder === 'asc' ? (
                  <ChevronUpIcon className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDownIcon className="ml-2 h-4 w-4" />
                )
              ) : (
                <ChevronsUpDown className="ml-2 h-4 w-4" />
              )}
            </div>
          );
        },
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
        size: 120,
      },
    ] satisfies DataTableColumnDef<OrganisationOverview>[];
  }, [sortOrder, sortBy]);

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
        search: debouncedSearchString,
        page,
        perPage,
        sortBy: column,
        sortOrder: sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc',
      });
    });
  };

  return (
    <div className="relative">
      <Input
        className="my-6 flex flex-row gap-4"
        type="text"
        placeholder={_(msg`Search by organisation name`)}
        value={searchString}
        onChange={handleChange}
      />
      <DataTable
        columns={columns}
        data={organisations}
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
