import type { TGetAdminOrganisationResponse } from '@documenso/trpc/server/admin-router/get-admin-organisation.types';
import { DataTable, type DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { useLingui } from '@lingui/react/macro';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { useAdminOrganisationInsights } from '~/components/general/use-admin-organisation-insights';

type TeamRow = TGetAdminOrganisationResponse['teams'][number] & {
  memberCount?: number;
  documentCount?: number;
};

type AdminOrganisationTeamsTableProps = {
  organisation: TGetAdminOrganisationResponse;
};

export const AdminOrganisationTeamsTable = ({ organisation }: AdminOrganisationTeamsTableProps) => {
  const { t, i18n } = useLingui();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // The team rows are already on the page. Insights adds the counts, which stay undefined until it answers.
  const { insights } = useAdminOrganisationInsights({ organisationId: organisation.id, view: 'teams', perPage: 100 });

  const counts = new Map(insights?.teams.map((team) => [team.id, team]));

  const teams: TeamRow[] = organisation.teams
    .map((team) => {
      const count = counts.get(team.id);

      return {
        ...team,
        memberCount: count && Number(count.memberCount),
        documentCount: count && Number(count.documentCount),
      };
    })
    .sort((a, b) => (b.documentCount ?? 0) - (a.documentCount ?? 0) || a.name.localeCompare(b.name));

  const totalPages = Math.max(1, Math.ceil(teams.length / perPage));
  const currentPage = Math.min(page, totalPages);

  const columns = useMemo(() => {
    return [
      {
        header: t`Team`,
        cell: ({ row }) => (
          <div className="max-w-[380px]">
            <Link
              className="block truncate font-medium hover:underline"
              to={`/admin/teams/${row.original.id}`}
              title={row.original.name}
            >
              {row.original.name}
            </Link>
            <div className="truncate font-mono text-muted-foreground text-xs">/t/{row.original.url}</div>
          </div>
        ),
      },
      {
        header: t`Team ID`,
        accessorKey: 'id',
        cell: ({ row }) => <span className="font-mono text-muted-foreground text-xs">{row.original.id}</span>,
      },
      {
        id: 'members',
        header: () => <div className="text-right">{t`Members`}</div>,
        cell: ({ row }) => <Count value={row.original.memberCount} />,
      },
      {
        id: 'documents',
        header: () => <div className="text-right">{t`Documents`}</div>,
        cell: ({ row }) => <Count value={row.original.documentCount} />,
      },
      {
        header: t`Created`,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {i18n.date(row.original.createdAt, { dateStyle: 'medium' })}
          </span>
        ),
      },
    ] satisfies DataTableColumnDef<TeamRow>[];
  }, [i18n, t]);

  return (
    <DataTable
      columns={columns}
      data={teams.slice((currentPage - 1) * perPage, currentPage * perPage)}
      perPage={perPage}
      currentPage={currentPage}
      totalPages={totalPages}
      onPaginationChange={(nextPage, nextPerPage) => {
        setPage(nextPage);
        setPerPage(nextPerPage);
      }}
    >
      {(table) =>
        table.getPageCount() > 1 || perPage > 10 ? (
          <DataTablePagination additionalInformation="None" table={table} />
        ) : null
      }
    </DataTable>
  );
};

/** A right-aligned number that holds its width while the count loads. */
const Count = ({ value }: { value: number | undefined }) => (
  <div className="flex justify-end tabular-nums">
    {value === undefined ? <Skeleton className="h-4 w-6" /> : value.toLocaleString()}
  </div>
);
