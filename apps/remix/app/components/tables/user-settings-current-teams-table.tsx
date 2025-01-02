import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useSearchParams } from 'react-router';
import { Link } from 'react-router';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { canExecuteTeamAction } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

import { TeamLeaveDialog } from '~/components/dialogs/team-leave-dialog';

export const UserSettingsCurrentTeamsDataTable = () => {
  const { _, i18n } = useLingui();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const parsedSearchParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));

  const { data, isLoading, isLoadingError } = trpc.team.findTeams.useQuery(
    {
      query: parsedSearchParams.query,
      page: parsedSearchParams.page,
      perPage: parsedSearchParams.perPage,
    },
    {
      placeholderData: (previousData) => previousData,
    },
  );

  const onPaginationChange = (page: number, perPage: number) => {
    updateSearchParams({
      page,
      perPage,
    });
  };

  const results = data ?? {
    data: [],
    perPage: 10,
    currentPage: 1,
    totalPages: 1,
  };

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Team`),
        accessorKey: 'name',
        cell: ({ row }) => (
          <Link to={`/t/${row.original.url}`} preventScrollReset={true}>
            <AvatarWithText
              avatarSrc={formatAvatarUrl(row.original.avatarImageId)}
              avatarClass="h-12 w-12"
              avatarFallback={row.original.name.slice(0, 1).toUpperCase()}
              primaryText={
                <span className="text-foreground/80 font-semibold">{row.original.name}</span>
              }
              secondaryText={`${NEXT_PUBLIC_WEBAPP_URL()}/t/${row.original.url}`}
            />
          </Link>
        ),
      },
      {
        header: _(msg`Role`),
        accessorKey: 'role',
        cell: ({ row }) =>
          row.original.ownerUserId === row.original.currentTeamMember.userId
            ? _(msg`Owner`)
            : _(TEAM_MEMBER_ROLE_MAP[row.original.currentTeamMember.role]),
      },
      {
        header: _(msg`Member Since`),
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex justify-end space-x-2">
            {canExecuteTeamAction('MANAGE_TEAM', row.original.currentTeamMember.role) && (
              <Button variant="outline" asChild>
                <Link to={`/t/${row.original.url}/settings`}>
                  <Trans>Manage</Trans>
                </Link>
              </Button>
            )}

            <TeamLeaveDialog
              teamId={row.original.id}
              teamName={row.original.name}
              teamAvatarImageId={row.original.avatarImageId}
              role={row.original.currentTeamMember.role}
              trigger={
                <Button
                  variant="destructive"
                  disabled={row.original.ownerUserId === row.original.currentTeamMember.userId}
                  onSelect={(e) => e.preventDefault()}
                >
                  <Trans>Leave</Trans>
                </Button>
              }
            />
          </div>
        ),
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
            <TableCell className="w-1/3 py-4 pr-4">
              <div className="flex w-full flex-row items-center">
                <Skeleton className="h-12 w-12 flex-shrink-0 rounded-full" />

                <div className="ml-2 flex flex-grow flex-col">
                  <Skeleton className="h-4 w-1/2 max-w-[8rem]" />
                  <Skeleton className="mt-1 h-4 w-2/3 max-w-[12rem]" />
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-12 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20 rounded-full" />
            </TableCell>
            <TableCell>
              <div className="flex flex-row justify-end space-x-2">
                <Skeleton className="h-10 w-20 rounded" />
                <Skeleton className="h-10 w-16 rounded" />
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
