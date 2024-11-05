import { Trans } from '@lingui/macro';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { AdminDocumentResults } from './document-results';

export default async function AdminDocumentsPage() {
  await setupI18nSSR();

  return (
    <div>
      <h2 className="text-4xl font-semibold">
        <Trans>Manage documents</Trans>
      </h2>

      <div className="mt-8">
        <AdminDocumentResults />
      </div>
    </div>
  );
}
