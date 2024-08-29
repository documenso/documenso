import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { DocumentLogsPageView } from './document-logs-page-view';

export type DocumentsLogsPageProps = {
  params: {
    id: string;
  };
};

export default function DocumentsLogsPage({ params }: DocumentsLogsPageProps) {
  setupI18nSSR();

  return <DocumentLogsPageView params={params} />;
}
