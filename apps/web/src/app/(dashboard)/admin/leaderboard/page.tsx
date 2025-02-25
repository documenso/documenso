import { Trans } from '@lingui/macro';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { isAdmin } from '@documenso/lib/next-auth/guards/is-admin';

import { LeaderboardTable, type SigningVolume } from './data-table-leaderboard';
import { DownloadButton } from './download-button';
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

export default async function Leaderboard({ searchParams = {} }: AdminLeaderboardProps) {
  await setupI18nSSR();

  const { user } = await getRequiredServerComponentSession();

  if (!isAdmin(user)) {
    throw new Error('Unauthorized');
  }

  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 10;
  const searchString = searchParams.search || '';
  const sortBy = searchParams.sortBy || 'signingVolume';
  const sortOrder = searchParams.sortOrder || 'desc';

  const { leaderboard, totalPages } = await search({
    search: searchString,
    page,
    perPage,
    sortBy,
    sortOrder,
  });

  const typedSigningVolume: SigningVolume[] = leaderboard.map((item) => ({
    ...item,
    name: item.name || '',
    createdAt: item.createdAt || new Date(),
  }));

  return (
    <div>
      <div className="flex items-center">
        <h2 className="text-4xl font-semibold">
          <Trans>Signing Volume</Trans>
        </h2>
        {/* TODO: remove */}
        <DownloadButton />
      </div>
      <div className="mt-8">
        <LeaderboardTable
          signingVolume={typedSigningVolume}
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
