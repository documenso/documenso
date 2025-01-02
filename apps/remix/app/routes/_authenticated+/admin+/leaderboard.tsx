import { Trans } from '@lingui/react/macro';

import { getSigningVolume } from '@documenso/lib/server-only/admin/get-signing-volume';

import { AdminLeaderboardTable } from '~/components/tables/admin-leaderboard-table';

import type { Route } from './+types/leaderboard';

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

  const { leaderboard: signingVolume, totalPages } = await getSigningVolume({
    search,
    page,
    perPage,
    sortBy,
    sortOrder,
  });

  return {
    signingVolume,
    totalPages,
    page,
    perPage,
    sortBy,
    sortOrder,
  };
}

export default function Leaderboard({ loaderData }: Route.ComponentProps) {
  const { signingVolume, totalPages, page, perPage, sortBy, sortOrder } = loaderData;

  return (
    <div>
      <h2 className="text-4xl font-semibold">
        <Trans>Signing Volume</Trans>
      </h2>
      <div className="mt-8">
        <AdminLeaderboardTable
          signingVolume={signingVolume}
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
