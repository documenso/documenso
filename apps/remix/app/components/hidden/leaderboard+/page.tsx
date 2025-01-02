import { Trans } from '@lingui/macro';

import { LeaderboardTable } from './data-table-leaderboard';
import { search } from './fetch-leaderboard.actions';

type AdminLeaderboardProps = {
  searchParams?: {
    search?: string;
    page?: number;
    perPage?: number;
    sortBy?: 'name' | 'createdAt' | 'signingVolume';
    sortOrder?: 'asc' | 'desc';
  };
};

export default async function LeaderboardPage({ searchParams = {} }: AdminLeaderboardProps) {
  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 10;
  const searchString = searchParams.search || '';
  const sortBy = searchParams.sortBy || 'signingVolume';
  const sortOrder = searchParams.sortOrder || 'desc';

  const { leaderboard: signingVolume, totalPages } = await search({
    search: searchString,
    page,
    perPage,
    sortBy,
    sortOrder,
  });

  return (
    <div>
      <h2 className="text-4xl font-semibold">
        <Trans>Signing Volume</Trans>
      </h2>
      <div className="mt-8">
        <LeaderboardTable
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
