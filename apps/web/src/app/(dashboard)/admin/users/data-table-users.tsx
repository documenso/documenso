'use client';

import { useTransition } from 'react';

import Link from 'next/link';

import { Edit, Loader } from 'lucide-react';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { Role } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';

interface User {
  id: number;
  name: string | null;
  email: string;
  roles: Role[];
  Subscription: Subscription[];
}

interface Subscription {
  id: number;
  status: string;
  planId: string | null;
  priceId: string | null;
  createdAt: Date | null;
  periodEnd: Date | null;
}

type UsersDataTableProps = {
  users: User[];
  perPage: number;
  page: number;
  totalPages: number;
};

export const UsersDataTable = ({ users, perPage, page, totalPages }: UsersDataTableProps) => {
  const [isPending, startTransition] = useTransition();
  const updateSearchParams = useUpdateSearchParams();
  console.log(users);

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
            cell: ({ row }) => <div>{row.original.id}</div>,
          },
          {
            header: 'Name',
            accessorKey: 'name',
            cell: ({ row }) => <div>{row.original.name}</div>,
          },
          {
            header: 'Email',
            accessorKey: 'email',
            cell: ({ row }) => <div>{row.original.email}</div>,
          },
          {
            header: 'Roles',
            accessorKey: 'roles',
            cell: ({ row }) => {
              return (
                <>
                  {row.original.roles.map((role: string, idx: number) => {
                    return (
                      <span key={idx}>
                        {role} {}
                      </span>
                    );
                  })}
                </>
              );
            },
          },
          {
            header: 'Subscription status',
            accessorKey: 'subscription',
            cell: ({ row }) => {
              return (
                <>
                  {row.original.Subscription.map((subscription: Subscription, idx: number) => {
                    return <span key={idx}>{subscription.status}</span>;
                  })}
                </>
              );
            },
          },
          {
            header: 'Edit',
            accessorKey: 'edit',
            cell: ({ row }) => {
              return (
                <div>
                  <Button className="w-24" asChild>
                    <Link href={`/admin/users/${row.original.id}`}>
                      <Edit className="-ml-1 mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                </div>
              );
            },
          },
        ]}
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
