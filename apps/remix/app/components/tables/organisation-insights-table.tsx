import { useTransition } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Archive, Building2, Loader, TrendingUp, Users } from 'lucide-react';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import type { OrganisationDetailedInsights } from '@documenso/lib/server-only/admin/get-organisation-detailed-insights';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';

import { DateRangeFilter } from '~/components/filters/date-range-filter';

type OrganisationInsightsTableProps = {
  insights: OrganisationDetailedInsights;
  page: number;
  perPage: number;
  dateRange: string;
  view: 'teams' | 'users' | 'documents';
};

export const OrganisationInsightsTable = ({
  insights,
  page,
  perPage,
  dateRange,
  view,
}: OrganisationInsightsTableProps) => {
  const { _, i18n } = useLingui();
  const [isPending, startTransition] = useTransition();
  const updateSearchParams = useUpdateSearchParams();

  const onPaginationChange = (newPage: number, newPerPage: number) => {
    startTransition(() => {
      updateSearchParams({
        page: newPage,
        perPage: newPerPage,
      });
    });
  };

  const handleViewChange = (newView: 'teams' | 'users' | 'documents') => {
    startTransition(() => {
      updateSearchParams({
        view: newView,
        page: 1,
      });
    });
  };

  const teamsColumns = [
    {
      header: _(msg`Team Name`),
      accessorKey: 'name',
      cell: ({ row }) => row.getValue('name'),
    },
    {
      header: _(msg`Members`),
      accessorKey: 'memberCount',
      cell: ({ row }) => Number(row.getValue('memberCount')),
    },
    {
      header: _(msg`Documents`),
      accessorKey: 'documentCount',
      cell: ({ row }) => Number(row.getValue('documentCount')),
    },
    {
      header: _(msg`Created`),
      accessorKey: 'createdAt',
      cell: ({ row }) => i18n.date(row.getValue('createdAt')),
    },
  ] satisfies DataTableColumnDef<(typeof insights.teams)[number]>[];

  const usersColumns = [
    {
      header: _(msg`Name`),
      accessorKey: 'name',
      cell: ({ row }) => row.getValue('name') || row.getValue('email'),
    },
    {
      header: _(msg`Email`),
      accessorKey: 'email',
      cell: ({ row }) => row.getValue('email'),
    },
    {
      header: _(msg`Documents Created`),
      accessorKey: 'documentCount',
      cell: ({ row }) => Number(row.getValue('documentCount')),
    },
    {
      header: _(msg`Documents Signed`),
      accessorKey: 'signedDocumentCount',
      cell: ({ row }) => Number(row.getValue('signedDocumentCount')),
    },
    {
      header: _(msg`Joined`),
      accessorKey: 'createdAt',
      cell: ({ row }) => i18n.date(row.getValue('createdAt')),
    },
  ] satisfies DataTableColumnDef<(typeof insights.users)[number]>[];

  const documentsColumns = [
    {
      header: _(msg`Title`),
      accessorKey: 'title',
      cell: ({ row }) => row.getValue('title'),
    },
    {
      header: _(msg`Status`),
      accessorKey: 'status',
      cell: ({ row }) => row.getValue('status'),
    },
    {
      header: _(msg`Team`),
      accessorKey: 'teamName',
      cell: ({ row }) => row.getValue('teamName'),
    },
    {
      header: _(msg`Created`),
      accessorKey: 'createdAt',
      cell: ({ row }) => i18n.date(row.getValue('createdAt')),
    },
    {
      header: _(msg`Completed`),
      accessorKey: 'completedAt',
      cell: ({ row }) => {
        const completedAt = row.getValue('completedAt') as Date | null;

        return completedAt ? i18n.date(completedAt) : '-';
      },
    },
  ] satisfies DataTableColumnDef<(typeof insights.documents)[number]>[];

  const getCurrentData = (): unknown[] => {
    switch (view) {
      case 'teams':
        return insights.teams;
      case 'users':
        return insights.users;
      case 'documents':
        return insights.documents;
      default:
        return [];
    }
  };

  const getCurrentColumns = (): DataTableColumnDef<unknown>[] => {
    switch (view) {
      case 'teams':
        return teamsColumns as unknown as DataTableColumnDef<unknown>[];
      case 'users':
        return usersColumns as unknown as DataTableColumnDef<unknown>[];
      case 'documents':
        return documentsColumns as unknown as DataTableColumnDef<unknown>[];
      default:
        return [];
    }
  };

  const SummaryCard = ({
    icon: Icon,
    title,
    value,
    subtitle,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    value: number;
    subtitle?: string;
  }) => (
    <div className="bg-card flex items-start gap-x-2 rounded-lg border px-4 py-3">
      <Icon className="text-muted-foreground h-4 w-4 items-start" />
      <div className="-mt-0.5 space-y-1">
        <p className="text-muted-foreground text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="relative">
      {insights.summary && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <SummaryCard icon={Building2} title={_(msg`Teams`)} value={insights.summary.totalTeams} />
          <SummaryCard icon={Users} title={_(msg`Members`)} value={insights.summary.totalMembers} />
          <SummaryCard
            icon={TrendingUp}
            title={_(msg`Volume (Period)`)}
            value={insights.summary.volumeThisPeriod}
            subtitle={_(msg`This time range`)}
          />
          <SummaryCard
            icon={Archive}
            title={_(msg`Volume (All Time)`)}
            value={insights.summary.volumeAllTime}
            subtitle={_(msg`Total completed`)}
          />
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={view === 'teams' ? 'default' : 'outline'}
            onClick={() => handleViewChange('teams')}
            disabled={isPending}
          >
            {_(msg`Teams`)}
          </Button>
          <Button
            variant={view === 'users' ? 'default' : 'outline'}
            onClick={() => handleViewChange('users')}
            disabled={isPending}
          >
            {_(msg`Users`)}
          </Button>
          <Button
            variant={view === 'documents' ? 'default' : 'outline'}
            onClick={() => handleViewChange('documents')}
            disabled={isPending}
          >
            {_(msg`Documents`)}
          </Button>
        </div>
        <DateRangeFilter currentRange={dateRange} />
      </div>

      <DataTable<unknown, unknown>
        columns={getCurrentColumns()}
        data={getCurrentData()}
        perPage={perPage}
        currentPage={page}
        totalPages={insights.totalPages}
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
