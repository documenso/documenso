'use client';

import { useEffect, useState, useTransition } from 'react';

import Link from 'next/link';

import { Edit, Loader } from 'lucide-react';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { Document, Role, Subscription } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useDebouncedValue } from '~/hooks/use-debounced-value';

import { search } from './fetch-users.actions';

interface User {
  id: number;
  name: string | null;
  email: string;
  roles: Role[];
  Subscription: SubscriptionLite[];
  Document: DocumentLite[];
}

type SubscriptionLite = Pick<
  Subscription,
  'id' | 'status' | 'planId' | 'priceId' | 'createdAt' | 'periodEnd'
>;

type DocumentLite = Pick<Document, 'id'>;

type UsersDataTableProps = {
  perPage: number;
  page: number;
};

export const UsersDataTable = ({ perPage, page }: UsersDataTableProps) => {
  const { toast } = useToast();

  const [isPending, startTransition] = useTransition();
  const updateSearchParams = useUpdateSearchParams();
  const [data, setData] = useState<User[]>([]);
  const [searchString, setSearchString] = useState('');
  const [totalPages, setTotalPages] = useState<number>(0);
  const debouncedSearchString = useDebouncedValue(searchString, 500);

  const onPaginationChange = (page: number, perPage: number) => {
    startTransition(() => {
      updateSearchParams({
        page,
        perPage,
      });
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await search(debouncedSearchString, page, perPage);
        setData(result.users);
        setTotalPages(result.totalPages);

        if (result.totalPages < page) {
          startTransition(() => {
            updateSearchParams({
              page: 1,
              perPage,
            });
          });
        }
      } catch (err) {
        throw new Error(err);
      }
    };

    fetchData().catch(() => {
      toast({
        title: 'Something went wrong',
        description: 'Please try again',
        variant: 'destructive',
      });
    });
  }, [debouncedSearchString, page, perPage]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchString(e.target.value);
  };

  return (
    <div className="relative">
      <Input
        className="my-6 flex flex-row gap-4"
        type="text"
        placeholder="Search by name or email"
        value={searchString}
        onChange={handleChange}
      />
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
                  {row.original.roles.map((role: string, i: number) => {
                    return (
                      <span key={i}>
                        {role} {}
                      </span>
                    );
                  })}
                </>
              );
            },
          },
          {
            header: 'Subscription',
            accessorKey: 'subscription',
            cell: ({ row }) => {
              if (row.original.Subscription && row.original.Subscription.length > 0) {
                return (
                  <>
                    {row.original.Subscription.map((subscription: SubscriptionLite, i: number) => {
                      return <span key={i}>{subscription.status}</span>;
                    })}
                  </>
                );
              } else {
                return <span>NONE</span>;
              }
            },
          },
          {
            header: 'Documents',
            accessorKey: 'documents',
            cell: ({ row }) => {
              return <div>{row.original.Document.length}</div>;
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
        data={data}
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
