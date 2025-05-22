import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

import { OrganisationLeaveDialog } from '../dialogs/organisation-leave-dialog';

export const UserOrganisationsTable = () => {
  const { _, i18n } = useLingui();
  const { user } = useSession();

  const { data, isLoading, isLoadingError } = trpc.organisation.getMany.useQuery();

  const results = {
    data: data || [],
    perPage: 10,
    currentPage: 1,
    totalPages: 1,
  };

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Organisation`),
        accessorKey: 'name',
        cell: ({ row }) => (
          <Link to={`/org/${row.original.url}`} preventScrollReset={true}>
            <AvatarWithText
              avatarSrc={formatAvatarUrl(row.original.avatarImageId)}
              avatarClass="h-12 w-12"
              avatarFallback={row.original.name.slice(0, 1).toUpperCase()}
              primaryText={
                <span className="text-foreground/80 font-semibold">{row.original.name}</span>
              }
              secondaryText={`${NEXT_PUBLIC_WEBAPP_URL()}/org/${row.original.url}`}
            />
          </Link>
        ),
      },
      {
        header: _(msg`Role`),
        accessorKey: 'role',
        cell: ({ row }) =>
          row.original.ownerUserId === user.id
            ? _(msg`Owner`)
            : _(ORGANISATION_MEMBER_ROLE_MAP[row.original.currentOrganisationRole]),
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
            {canExecuteOrganisationAction(
              'MANAGE_ORGANISATION',
              row.original.currentOrganisationRole,
            ) && (
              <Button variant="outline" asChild>
                <Link to={`/org/${row.original.url}/settings`}>
                  <Trans>Manage</Trans>
                </Link>
              </Button>
            )}

            <OrganisationLeaveDialog
              organisationId={row.original.id}
              organisationName={row.original.name}
              organisationAvatarImageId={row.original.avatarImageId}
              role={row.original.currentOrganisationRole}
              trigger={
                <Button
                  variant="destructive"
                  disabled={row.original.ownerUserId === user.id}
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
    <div>
      <DataTable
        columns={columns}
        data={results.data}
        perPage={results.perPage}
        currentPage={results.currentPage}
        totalPages={results.totalPages}
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
      />
    </div>
  );
};
