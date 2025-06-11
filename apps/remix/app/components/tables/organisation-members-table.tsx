import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { OrganisationGroupType } from '@prisma/client';
import { Edit, MoreHorizontal, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { EXTENDED_ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { isOrganisationRoleWithinUserHierarchy } from '@documenso/lib/utils/organisations';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
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

import { OrganisationMemberDeleteDialog } from '~/components/dialogs/organisation-member-delete-dialog';
import { OrganisationMemberUpdateDialog } from '~/components/dialogs/organisation-member-update-dialog';

export const OrganisationMembersDataTable = () => {
  const { _, i18n } = useLingui();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();
  const organisation = useCurrentOrganisation();

  const parsedSearchParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));

  const { data, isLoading, isLoadingError } = trpc.organisation.member.find.useQuery(
    {
      organisationId: organisation.id,
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
        header: _(msg`Organisation Member`),
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
        cell: ({ row }) =>
          organisation.ownerUserId === row.original.userId
            ? _(msg`Owner`)
            : _(EXTENDED_ORGANISATION_MEMBER_ROLE_MAP[row.original.currentOrganisationRole]),
      },
      {
        header: _(msg`Member Since`),
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        header: _(msg`Groups`),
        cell: ({ row }) =>
          row.original.groups.filter((group) => group.type === OrganisationGroupType.CUSTOM).length,
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

              <OrganisationMemberUpdateDialog
                currentUserOrganisationRole={organisation.currentOrganisationRole}
                organisationId={organisation.id}
                organisationMemberId={row.original.id}
                organisationMemberName={row.original.name ?? ''}
                organisationMemberRole={row.original.currentOrganisationRole}
                trigger={
                  <DropdownMenuItem
                    disabled={
                      organisation.ownerUserId === row.original.userId ||
                      !isOrganisationRoleWithinUserHierarchy(
                        organisation.currentOrganisationRole,
                        row.original.currentOrganisationRole,
                      )
                    }
                    onSelect={(e) => e.preventDefault()}
                    title="Update organisation member role"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    <Trans>Update role</Trans>
                  </DropdownMenuItem>
                }
              />

              <OrganisationMemberDeleteDialog
                organisationMemberId={row.original.id}
                organisationMemberName={row.original.name ?? ''}
                organisationMemberEmail={row.original.email}
                trigger={
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    disabled={
                      organisation.ownerUserId === row.original.userId ||
                      !isOrganisationRoleWithinUserHierarchy(
                        organisation.currentOrganisationRole,
                        row.original.currentOrganisationRole,
                      )
                    }
                    title={_(msg`Remove organisation member`)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
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
      {(table) =>
        results.totalPages > 1 && (
          <DataTablePagination additionalInformation="VisibleCount" table={table} />
        )
      }
    </DataTable>
  );
};
