import { Trans } from '@lingui/macro';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getSigningVolume } from '@documenso/lib/server-only/admin/get-signing-volume';

import { DataTableDemo as Table } from './table';

export default async function Leaderboard() {
  setupI18nSSR();

  const signingVolume = await getSigningVolume();

  console.log(signingVolume);

  return (
    <div>
      <h2 className="text-4xl font-semibold">
        <Trans>Signing Volume</Trans>
      </h2>
      <div className="mt-8">
        <Table />
      </div>
    </div>
  );
}
