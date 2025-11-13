import { useTransition } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Building2, Loader, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router';
import { useNavigation } from 'react-router';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import type { OrganisationDetailedInsights } from '@documenso/lib/server-only/admin/get-organisation-detailed-insights';
import type { DateRange } from '@documenso/lib/types/search-params';
import type { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';

import { DateRangeFilter } from '~/components/filters/date-range-filter';
import { DocumentStatus } from '~/components/general/document/document-status';

type OrganisationInsightsTableProps = {
  insights: OrganisationDetailedInsights;
  page: number;
  perPage: number;
  dateRange: DateRange;
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
  const navigation = useNavigation();
  const updateSearchParams = useUpdateSearchParams();

  const isLoading = isPending || navigation.state === 'loading';

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
      cell: ({ row }) => <span className="block max-w-full truncate">{row.getValue('name')}</span>,
      size: 240,
    },
    {
      header: _(msg`Members`),
      accessorKey: 'memberCount',
      cell: ({ row }) => Number(row.getValue('memberCount')),
      size: 120,
    },
    {
      header: _(msg`Documents`),
      accessorKey: 'documentCount',
      cell: ({ row }) => Number(row.getValue('documentCount')),
      size: 140,
    },
    {
      header: _(msg`Created`),
      accessorKey: 'createdAt',
      cell: ({ row }) => i18n.date(new Date(row.getValue('createdAt'))),
      size: 160,
    },
  ] satisfies DataTableColumnDef<(typeof insights.teams)[number]>[];

  const usersColumns = [
    {
      header: () => <span className="whitespace-nowrap">{_(msg`Name`)}</span>,
      accessorKey: 'name',
      cell: ({ row }) => (
        <Link
          className="block max-w-full truncate hover:underline"
          to={`/admin/users/${row.original.id}`}
        >
          {(row.getValue('name') as string) || (row.getValue('email') as string)}
        </Link>
      ),
      size: 220,
    },
    {
      header: () => <span className="whitespace-nowrap">{_(msg`Email`)}</span>,
      accessorKey: 'email',
      cell: ({ row }) => <span className="block max-w-full truncate">{row.getValue('email')}</span>,
      size: 260,
    },
    {
      header: () => <span className="whitespace-nowrap">{_(msg`Documents Created`)}</span>,
      accessorKey: 'documentCount',
      cell: ({ row }) => Number(row.getValue('documentCount')),
      size: 180,
    },
    {
      header: () => <span className="whitespace-nowrap">{_(msg`Documents Completed`)}</span>,
      accessorKey: 'signedDocumentCount',
      cell: ({ row }) => Number(row.getValue('signedDocumentCount')),
      size: 180,
    },
    {
      header: () => <span className="whitespace-nowrap">{_(msg`Joined`)}</span>,
      accessorKey: 'createdAt',
      cell: ({ row }) => i18n.date(new Date(row.getValue('createdAt'))),
      size: 160,
    },
  ] satisfies DataTableColumnDef<(typeof insights.users)[number]>[];

  const documentsColumns = [
    {
      header: () => <span className="whitespace-nowrap">{_(msg`Title`)}</span>,
      accessorKey: 'title',
      cell: ({ row }) => (
        <Link
          className="block max-w-[200px] truncate hover:underline"
          to={`/admin/documents/${row.original.id}`}
          title={row.getValue('title') as string}
        >
          {row.getValue('title')}
        </Link>
      ),
      size: 200,
    },
    {
      header: () => <span className="whitespace-nowrap">{_(msg`Status`)}</span>,
      accessorKey: 'status',
      cell: ({ row }) => (
        <DocumentStatus status={row.getValue('status') as ExtendedDocumentStatus} />
      ),
      size: 120,
    },
    {
      header: () => <span className="whitespace-nowrap">{_(msg`Team`)}</span>,
      accessorKey: 'teamName',
      cell: ({ row }) => (
        <span className="block max-w-[150px] truncate" title={row.getValue('teamName') as string}>
          {row.getValue('teamName')}
        </span>
      ),
      size: 150,
    },
    {
      header: () => <span className="whitespace-nowrap">{_(msg`Created`)}</span>,
      accessorKey: 'createdAt',
      cell: ({ row }) => i18n.date(new Date(row.getValue('createdAt'))),
      size: 140,
    },
    {
      header: () => <span className="whitespace-nowrap">{_(msg`Completed`)}</span>,
      accessorKey: 'completedAt',
      cell: ({ row }) => {
        const completedAt = row.getValue('completedAt') as Date | null;

        return completedAt ? i18n.date(new Date(completedAt)) : '-';
      },
      size: 140,
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

  return (
    <div className="relative">
      {insights.summary && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <SummaryCard icon={Building2} title={_(msg`Teams`)} value={insights.summary.totalTeams} />
          <SummaryCard icon={Users} title={_(msg`Members`)} value={insights.summary.totalMembers} />
          <SummaryCard
            icon={TrendingUp}
            title={_(msg`Documents Completed`)}
            value={insights.summary.volumeThisPeriod}
          />
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={view === 'teams' ? 'default' : 'outline'}
            onClick={() => handleViewChange('teams')}
            disabled={isLoading}
          >
            {_(msg`Teams`)}
          </Button>
          <Button
            variant={view === 'users' ? 'default' : 'outline'}
            onClick={() => handleViewChange('users')}
            disabled={isLoading}
          >
            {_(msg`Users`)}
          </Button>
          <Button
            variant={view === 'documents' ? 'default' : 'outline'}
            onClick={() => handleViewChange('documents')}
            disabled={isLoading}
          >
            {_(msg`Documents`)}
          </Button>
        </div>
        <DateRangeFilter currentRange={dateRange} />
      </div>

      <div className={view === 'documents' ? 'overflow-hidden' : undefined}>
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
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      )}
    </div>
  );
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
    <div className="-mt-0.5 space-y-2">
      <p className="text-muted-foreground text-sm font-medium">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
      {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
    </div>
  </div>
);
