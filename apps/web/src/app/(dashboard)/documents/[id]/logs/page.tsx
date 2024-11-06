import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { DocumentLogsPageView } from './document-logs-page-view';

export type DocumentsLogsPageProps = {
  params: {
    id: string;
  };
};

export default async function DocumentsLogsPage({ params }: DocumentsLogsPageProps) {
  await setupI18nSSR();

  return <DocumentLogsPageView params={params} />;
}
