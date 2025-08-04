import { Trans } from '@lingui/react/macro';

import { getOrganisationInsights } from '@documenso/lib/server-only/admin/get-signing-volume';

import { DateRangeFilter } from '~/components/filters/date-range-filter';
import {
  AdminOrganisationOverviewTable,
  type OrganisationOverview,
} from '~/components/tables/admin-organisation-overview-table';

import type { Route } from './+types/org-insights';

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);

  const rawSortBy = url.searchParams.get('sortBy') || 'signingVolume';
  const rawSortOrder = url.searchParams.get('sortOrder') || 'desc';

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const sortOrder = (['asc', 'desc'].includes(rawSortOrder) ? rawSortOrder : 'desc') as
    | 'asc'
    | 'desc';
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const sortBy = (
    ['name', 'createdAt', 'signingVolume'].includes(rawSortBy) ? rawSortBy : 'signingVolume'
  ) as 'name' | 'createdAt' | 'signingVolume';

  const page = Number(url.searchParams.get('page')) || 1;
  const perPage = Number(url.searchParams.get('perPage')) || 10;
  const search = url.searchParams.get('search') || '';
  const dateRange = (url.searchParams.get('dateRange') || 'last30days') as
    | 'last30days'
    | 'last90days'
    | 'lastYear'
    | 'allTime';

  const { organisations, totalPages } = await getOrganisationInsights({
    search,
    page,
    perPage,
    sortBy,
    sortOrder,
    dateRange,
  });

  const typedOrganisations: OrganisationOverview[] = organisations.map((item) => ({
    id: String(item.id),
    name: item.name || '',
    signingVolume: item.signingVolume,
    createdAt: item.createdAt || new Date(),
    planId: item.customerId || '',
    subscriptionStatus: item.subscriptionStatus,
    teamCount: item.teamCount || 0,
    memberCount: item.memberCount || 0,
  }));

  return {
    organisations: typedOrganisations,
    totalPages,
    page,
    perPage,
    sortBy,
    sortOrder,
    dateRange,
  };
}

export default function Organisations({ loaderData }: Route.ComponentProps) {
  const { organisations, totalPages, page, perPage, sortBy, sortOrder, dateRange } = loaderData;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-semibold">
          <Trans>Organisation Insights</Trans>
        </h2>
        <DateRangeFilter currentRange={dateRange} />
      </div>

      <div className="mt-8">
        <AdminOrganisationOverviewTable
          organisations={organisations}
          totalPages={totalPages}
          page={page}
          perPage={perPage}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      </div>
    </div>
  );
}
