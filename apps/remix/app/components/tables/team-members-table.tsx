import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { EditIcon, MoreHorizontal, Trash2Icon } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { EXTENDED_TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams-translations';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

import { useCurrentTeam } from '~/providers/team';

import { TeamMemberDeleteDialog } from '../dialogs/team-member-delete-dialog';
import { TeamMemberUpdateDialog } from '../dialogs/team-member-update-dialog';

export const TeamMembersTable = () => {
  const { _ } = useLingui();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const organisation = useCurrentOrganisation();
  const team = useCurrentTeam();

  const parsedSearchParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));

  const { data, isLoading, isLoadingError } = trpc.team.member.find.useQuery(
    {
      teamId: team.id,
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
        header: _(msg`Team Member`),
        cell: ({ row }) => {
          const avatarFallbackText = row.original.name
            ? extractInitials(row.original.name)
            : row.original.email.slice(0, 1).toUpperCase();

          return (
            <AvatarWithText
              avatarClass="h-12 w-12"
              avatarFallback={avatarFallbackText}
              primaryText={
                <span className="text-foreground/80 font-semibold">{row.original.name}</span>
              }
              secondaryText={row.original.email}
            />
          );
        },
      },
      {
        header: _(msg`Role`),
        accessorKey: 'role',
        cell: ({ row }) => _(EXTENDED_TEAM_MEMBER_ROLE_MAP[row.original.teamRole]),
      },
      {
        header: _(msg`Source`),
        cell: ({ row }) => _(msg`Group`),
        // cell: ({ row }) => (row.original.type === 'member' ? _(msg`Member`) : _(msg`Group`)),
      },
      {
        header: _(msg`Actions`),
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <MoreHorizontal className="text-muted-foreground h-5 w-5" />
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-52" align="start" forceMount>
              <DropdownMenuLabel>
                <Trans>Actions</Trans>
              </DropdownMenuLabel>

              <TeamMemberUpdateDialog
                currentUserTeamRole={team.currentTeamRole}
                teamId={team.id}
                memberId={row.original.id}
                memberName={row.original.name ?? ''}
                memberTeamRole={row.original.teamRole}
                trigger={
                  <DropdownMenuItem
                    disabled={
                      organisation.ownerUserId === row.original.userId ||
                      !isTeamRoleWithinUserHierarchy(team.currentTeamRole, row.original.teamRole)
                    }
                    onSelect={(e) => e.preventDefault()}
                    title="Update team member role"
                  >
                    <EditIcon className="mr-2 h-4 w-4" />
                    <Trans>Update role</Trans>
                  </DropdownMenuItem>
                }
              />

              <TeamMemberDeleteDialog
                teamId={team.id}
                teamName={team.name}
                memberId={row.original.id}
                memberName={row.original.name ?? ''}
                memberEmail={row.original.email}
                trigger={
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    disabled={
                      organisation.ownerUserId === row.original.userId ||
                      !isTeamRoleWithinUserHierarchy(team.currentTeamRole, row.original.teamRole)
                    }
                    title={_(msg`Remove team member`)}
                  >
                    <Trash2Icon className="mr-2 h-4 w-4" />
                    <Trans>Remove</Trans>
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
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
            <TableCell className="w-1/2 py-4 pr-4">
              <div className="flex w-full flex-row items-center">
                <Skeleton className="h-12 w-12 flex-shrink-0 rounded-full" />

                <div className="ml-2 flex flex-grow flex-col">
                  <Skeleton className="h-4 w-1/3 max-w-[8rem]" />
                  <Skeleton className="mt-1 h-4 w-1/2 max-w-[12rem]" />
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
              <Skeleton className="h-4 w-6 rounded-full" />
            </TableCell>
          </>
        ),
      }}
    >
      {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
    </DataTable>
  );
};
