import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import {
  EMAIL_SUPPRESSION_SCOPE_MAP,
  EMAIL_SUPPRESSION_SOURCE_MAP,
} from '@documenso/lib/constants/email-suppression-translations';
import { trpc } from '@documenso/trpc/react';
import type { TFindEmailSuppressionsResponse } from '@documenso/trpc/server/admin-router/email-suppression/find-email-suppressions.types';
import { Badge } from '@documenso/ui/primitives/badge';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { useLingui } from '@lingui/react/macro';
import { useQueryStates } from 'nuqs';
import { useMemo } from 'react';
import { Link } from 'react-router';

import { adminEmailSuppressionsSearchParams } from '~/utils/admin-email-suppressions-search-params';

import { EmailSuppressionDeleteDialog } from '../dialogs/email-suppression-delete-dialog';

export const AdminEmailSuppressionsTable = () => {
  const { t, i18n } = useLingui();

  const [{ query, page, perPage }, setSearchParams] = useQueryStates(adminEmailSuppressionsSearchParams, {
    history: 'push',
  });

  // The search input updates `query` on every keystroke, so wait for typing to pause.
  const debouncedQuery = useDebouncedValue(query, 500);

  const { data, isLoading, isLoadingError } = trpc.admin.emailSuppression.find.useQuery(
    {
      query: debouncedQuery ?? undefined,
      page: Math.max(page ?? 1, 1),
      perPage: Math.min(Math.max(perPage ?? 20, 1), 100),
    },
    {
      placeholderData: (previousData) => previousData,
    },
  );

  const onPaginationChange = (newPage: number, newPerPage: number) => {
    void setSearchParams({
      page: newPage,
      perPage: newPerPage,
    });
  };

  const results = data ?? {
    data: [],
    perPage: 20,
    currentPage: 1,
    totalPages: 1,
  };

  const columns = useMemo(() => {
    return [
      {
        header: t`Email`,
        accessorKey: 'email',
        cell: ({ row }) => (
          <div className="max-w-[18rem]">
            <p className="truncate" title={row.original.email}>
              {row.original.email}
            </p>

            {row.original.reason && (
              <p className="truncate text-muted-foreground text-xs" title={row.original.reason}>
                {row.original.reason}
              </p>
            )}
          </div>
        ),
      },
      {
        header: t`Blocked sender`,
        accessorKey: 'scope',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Badge variant="neutral">{i18n._(EMAIL_SUPPRESSION_SCOPE_MAP[row.original.scope])}</Badge>
            <SuppressedSenderLink suppression={row.original} />
          </div>
        ),
      },
      {
        header: t`Source`,
        accessorKey: 'source',
        cell: ({ row }) => i18n._(EMAIL_SUPPRESSION_SOURCE_MAP[row.original.source]),
      },
      {
        header: t`Created`,
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        id: 'actions',
        cell: ({ row }) => <EmailSuppressionDeleteDialog suppressionId={row.original.id} email={row.original.email} />,
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, []);

  return (
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
              <Skeleton className="h-4 w-40 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-32 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20 rounded-full" />
            </TableCell>
            <TableCell>
              <div className="flex flex-row justify-end">
                <Skeleton className="h-8 w-16 rounded" />
              </div>
            </TableCell>
          </>
        ),
      }}
    >
      {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
    </DataTable>
  );
};

type SuppressedSenderLinkProps = {
  suppression: TFindEmailSuppressionsResponse['data'][number];
};

const SuppressedSenderLink = ({ suppression }: SuppressedSenderLinkProps) => {
  const { organisation, team, user } = suppression;

  if (organisation) {
    return (
      <Link to={`/admin/organisations/${organisation.id}`} className="max-w-[12rem] truncate hover:underline">
        {organisation.name}
      </Link>
    );
  }

  if (team) {
    return (
      <Link to={`/admin/teams/${team.id}`} className="max-w-[12rem] truncate hover:underline">
        {team.name}
      </Link>
    );
  }

  if (user) {
    return (
      <Link to={`/admin/users/${user.id}`} className="max-w-[12rem] truncate hover:underline">
        {user.name || user.email}
      </Link>
    );
  }

  return null;
};
