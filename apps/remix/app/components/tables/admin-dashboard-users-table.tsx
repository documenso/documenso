import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Input } from '@documenso/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { Trans, useLingui } from '@lingui/react/macro';
import { Role } from '@prisma/client';
import { EditIcon, LoaderIcon } from 'lucide-react';
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useMemo } from 'react';
import { Link } from 'react-router';

export const AdminDashboardUsersTable = () => {
  const { t } = useLingui();

  const [searchParams, setSearchParams] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      role: parseAsStringLiteral([Role.ADMIN]),
      page: parseAsInteger,
      perPage: parseAsInteger,
    },
    {
      history: 'push',
    },
  );

  const debouncedQuery = useDebouncedValue(searchParams.query, 500);

  // Hand-edited values such as `?page=0` or `?perPage=500` would otherwise fail
  // request validation and leave the table stuck in its error state.
  const { page, perPage } = ZUrlSearchParamsSchema.parse({
    page: searchParams.page ?? undefined,
    perPage: searchParams.perPage ?? undefined,
  });

  const { data, isLoading, isLoadingError, isPlaceholderData } = trpc.admin.user.find.useQuery(
    {
      query: debouncedQuery || undefined,
      role: searchParams.role ?? undefined,
      page,
      perPage,
    },
    {
      placeholderData: (previousData) => previousData,
    },
  );

  const results = data ?? {
    data: [],
    perPage: 10,
    currentPage: 1,
    totalPages: 1,
  };

  const columns = useMemo(() => {
    return [
      {
        header: t`ID`,
        accessorKey: 'id',
        cell: ({ row }) => <div>{row.original.id}</div>,
      },
      {
        header: t`Name`,
        accessorKey: 'name',
        cell: ({ row }) => <div>{row.original.name}</div>,
      },
      {
        header: t`Email`,
        accessorKey: 'email',
        cell: ({ row }) => <div>{row.original.email}</div>,
      },
      {
        header: t`Roles`,
        accessorKey: 'roles',
        cell: ({ row }) => row.original.roles.join(', '),
      },
      {
        header: t`Documents`,
        accessorKey: 'documentCount',
      },
      {
        header: '',
        accessorKey: 'edit',
        cell: ({ row }) => {
          return (
            <Button className="w-24" asChild>
              <Link to={`/admin/users/${row.original.id}`}>
                <EditIcon className="mr-2 -ml-1 h-4 w-4" />
                <Trans>Edit</Trans>
              </Link>
            </Button>
          );
        },
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, []);

  const onPaginationChange = (newPage: number, newPerPage: number) => {
    void setSearchParams({
      page: newPage,
      perPage: newPerPage,
    });
  };

  const onSearchChange = (value: string) => {
    // Replace so typing doesn't add a history entry per keystroke, and reset
    // pagination so a new search never lands on an empty page.
    void setSearchParams(
      {
        query: value,
        page: null,
      },
      {
        history: 'replace',
      },
    );
  };

  const onRoleChange = (value: string) => {
    void setSearchParams({
      role: value === Role.ADMIN ? Role.ADMIN : null,
      page: null,
    });
  };

  return (
    <div>
      <div className="my-6 flex flex-col gap-4 sm:flex-row">
        <Input
          className="flex-1"
          type="text"
          placeholder={t`Search by name or email`}
          value={searchParams.query}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        <Select value={searchParams.role ?? ALL_ROLES_VALUE} onValueChange={onRoleChange}>
          <SelectTrigger className="w-full sm:w-48" aria-label={t`Filter by role`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ROLES_VALUE}>
              <Trans>All users</Trans>
            </SelectItem>
            <SelectItem value={Role.ADMIN}>
              <Trans>Admins</Trans>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="relative">
        <DataTable
          columns={columns}
          data={results.data}
          perPage={results.perPage}
          currentPage={results.currentPage}
          totalPages={results.totalPages}
          onPaginationChange={onPaginationChange}
          error={{
            enable: isLoadingError,
          }}
          skeleton={{
            enable: isLoading,
            rows: 3,
            component: (
              <>
                <TableCell className="py-4 pr-4">
                  <Skeleton className="h-4 w-8 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-12 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-8 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-10 w-24 rounded" />
                </TableCell>
              </>
            ),
          }}
        >
          {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
        </DataTable>

        {isPlaceholderData && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <LoaderIcon className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
};

const ALL_ROLES_VALUE = 'ALL';
