import { useMemo } from 'react';

import { useLingui } from '@lingui/react';
import { useLingui as useLinguiMacro } from '@lingui/react/macro';
import { Link, useSearchParams } from 'react-router';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams-translations';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import type { TeamMemberRole } from '@documenso/prisma/generated/types';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@documenso/ui/primitives/hover-card';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

type AdminUserTeamsTableProps = {
  userId: number;
};

export const AdminUserTeamsTable = ({ userId }: AdminUserTeamsTableProps) => {
  const { i18n } = useLingui();
  const { t } = useLinguiMacro();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const parsedSearchParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));

  const { data, isLoading, isLoadingError } = trpc.admin.user.findTeams.useQuery({
    userId,
    query: parsedSearchParams.query,
    page: parsedSearchParams.page,
    perPage: parsedSearchParams.perPage,
  });

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
        header: t`Team`,
        accessorKey: 'name',
        cell: ({ row }) => (
          <HoverCard>
            <HoverCardTrigger className="cursor-default underline decoration-dotted underline-offset-4">
              {row.original.name}
            </HoverCardTrigger>
            <HoverCardContent
              className="w-auto font-mono text-xs text-muted-foreground"
              align="start"
            >
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt>id</dt>
                <dd>{row.original.id}</dd>
                <dt>url</dt>
                <dd>{row.original.url}</dd>
              </dl>
            </HoverCardContent>
          </HoverCard>
        ),
      },
      {
        header: t`Organisation`,
        accessorKey: 'organisation',
        cell: ({ row }) => (
          <Link
            to={`/admin/organisations/${row.original.organisation.id}`}
            className="hover:underline"
          >
            {row.original.organisation.name}
          </Link>
        ),
      },
      {
        header: t`Role`,
        accessorKey: 'teamRole',
        cell: ({ row }) => (
          <Badge variant="neutral">
            {i18n._(TEAM_MEMBER_ROLE_MAP[row.original.teamRole as TeamMemberRole])}
          </Badge>
        ),
      },
      {
        header: t`Created At`,
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
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
              <Skeleton className="h-4 w-20 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-12 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16 rounded-full" />
            </TableCell>
          </>
        ),
      }}
    >
      {(table) =>
        table.getPageCount() > 1 ? (
          <DataTablePagination additionalInformation="VisibleCount" table={table} />
        ) : null
      }
    </DataTable>
  );
};
