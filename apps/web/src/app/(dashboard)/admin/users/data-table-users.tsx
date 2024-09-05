'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Edit, Loader } from 'lucide-react';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import type { Document, Role, Subscription } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Input } from '@documenso/ui/primitives/input';

type UserData = {
  id: number;
  name: string | null;
  email: string;
  roles: Role[];
  Subscription?: SubscriptionLite[] | null;
  Document: DocumentLite[];
};

type SubscriptionLite = Pick<
  Subscription,
  'id' | 'status' | 'planId' | 'priceId' | 'createdAt' | 'periodEnd'
>;

type DocumentLite = Pick<Document, 'id'>;

type UsersDataTableProps = {
  users: UserData[];
  totalPages: number;
  perPage: number;
  page: number;
  individualPriceIds: string[];
};

export const UsersDataTable = ({
  users,
  totalPages,
  perPage,
  page,
  individualPriceIds,
}: UsersDataTableProps) => {
  const { _ } = useLingui();

  const [isPending, startTransition] = useTransition();
  const updateSearchParams = useUpdateSearchParams();
  const [searchString, setSearchString] = useState('');
  const debouncedSearchString = useDebouncedValue(searchString, 1000);

  const columns = useMemo(() => {
    return [
      {
        header: 'ID',
        accessorKey: 'id',
        cell: ({ row }) => <div>{row.original.id}</div>,
      },
      {
        header: _(msg`Name`),
        accessorKey: 'name',
        cell: ({ row }) => <div>{row.original.name}</div>,
      },
      {
        header: _(msg`Email`),
        accessorKey: 'email',
        cell: ({ row }) => <div>{row.original.email}</div>,
      },
      {
        header: _(msg`Roles`),
        accessorKey: 'roles',
        cell: ({ row }) => row.original.roles.join(', '),
      },
      {
        header: _(msg`Subscription`),
        accessorKey: 'subscription',
        cell: ({ row }) => {
          const foundIndividualSubscription = (row.original.Subscription ?? []).find((sub) =>
            individualPriceIds.includes(sub.priceId),
          );

          return foundIndividualSubscription?.status ?? 'NONE';
        },
      },
      {
        header: _(msg`Documents`),
        accessorKey: 'documents',
        cell: ({ row }) => {
          return <div>{row.original.Document.length}</div>;
        },
      },
      {
        header: '',
        accessorKey: 'edit',
        cell: ({ row }) => {
          return (
            <Button className="w-24" asChild>
              <Link href={`/admin/users/${row.original.id}`}>
                <Edit className="-ml-1 mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          );
        },
      },
    ] satisfies DataTableColumnDef<(typeof users)[number]>[];
  }, [individualPriceIds]);

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
        data={users}
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
