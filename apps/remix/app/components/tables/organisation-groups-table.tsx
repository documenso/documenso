import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { OrganisationGroupType } from '@prisma/client';
import { Link, useSearchParams } from 'react-router';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { EXTENDED_ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

import { OrganisationGroupDeleteDialog } from '../dialogs/organisation-group-delete-dialog';

export const OrganisationGroupsDataTable = () => {
  const { _ } = useLingui();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();
  const organisation = useCurrentOrganisation();

  const parsedSearchParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));

  const { data, isLoading, isLoadingError } = trpc.organisation.group.find.useQuery(
    {
      organisationId: organisation.id,
      query: parsedSearchParams.query,
      page: parsedSearchParams.page,
      perPage: parsedSearchParams.perPage,
      types: [OrganisationGroupType.CUSTOM],
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
        header: _(msg`Group`),
        accessorKey: 'name',
      },
      {
        header: _(msg`Role`),
        accessorKey: 'organisationRole',
        cell: ({ row }) => _(EXTENDED_ORGANISATION_MEMBER_ROLE_MAP[row.original.organisationRole]),
      },
      {
        header: _(msg`Members`),
        accessorKey: 'members',
        cell: ({ row }) => row.original.members.length,
      },
      {
        header: _(msg`Assigned Teams`),
        accessorKey: 'teams',
        cell: ({ row }) => row.original.teams.length,
      },
      {
        header: _(msg`Actions`),
        cell: ({ row }) => (
          <div className="flex justify-end space-x-2">
            <Button asChild variant="outline">
              <Link to={`/org/${organisation.url}/settings/groups/${row.original.id}`}>Manage</Link>
            </Button>

            <OrganisationGroupDeleteDialog
              organisationGroupId={row.original.id}
              organisationGroupName={row.original.name ?? ''}
              trigger={
                <Button variant="destructive" title={_(msg`Remove organisation group`)}>
                  <Trans>Delete</Trans>
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
