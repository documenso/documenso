import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { DocumentEditPageView } from './document-edit-page-view';

export type DocumentPageProps = {
  params: {
    id: string;
  };
};

export default function DocumentEditPage({ params }: DocumentPageProps) {
  setupI18nSSR();

  return <DocumentEditPageView params={params} />;
}
