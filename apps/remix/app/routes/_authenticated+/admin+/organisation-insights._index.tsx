import { Trans } from '@lingui/react/macro';

import { getOrganisationInsights } from '@documenso/lib/server-only/admin/get-signing-volume';
import type { DateRange } from '@documenso/lib/types/search-params';

import { DateRangeFilter } from '~/components/filters/date-range-filter';
import {
  AdminOrganisationOverviewTable,
  type OrganisationOverview,
} from '~/components/tables/admin-organisation-overview-table';

import type { Route } from './+types/organisation-insights._index';

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);

  const rawSortBy = url.searchParams.get('sortBy') || 'signingVolume';
  const rawSortOrder = url.searchParams.get('sortOrder') || 'desc';

  const isSortOrder = (value: string): value is 'asc' | 'desc' =>
    value === 'asc' || value === 'desc';
  const isSortBy = (value: string): value is 'name' | 'createdAt' | 'signingVolume' =>
    value === 'name' || value === 'createdAt' || value === 'signingVolume';

  const sortOrder: 'asc' | 'desc' = isSortOrder(rawSortOrder) ? rawSortOrder : 'desc';
  const sortBy: 'name' | 'createdAt' | 'signingVolume' = isSortBy(rawSortBy)
    ? rawSortBy
    : 'signingVolume';

  const page = Number(url.searchParams.get('page')) || 1;
  const perPage = Number(url.searchParams.get('perPage')) || 10;
  const search = url.searchParams.get('search') || '';
  const dateRange = (url.searchParams.get('dateRange') || 'last30days') as DateRange;

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
    signingVolume: item.signingVolume || 0,
    createdAt: item.createdAt || new Date(),
    customerId: item.customerId || '',
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
          dateRange={dateRange}
        />
      </div>
    </div>
  );
}
