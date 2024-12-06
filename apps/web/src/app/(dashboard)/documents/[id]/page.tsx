import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { DocumentPageView } from './document-page-view';

export type DocumentPageProps = {
  params: {
    id: string;
  };
};

export default async function DocumentPage({ params }: DocumentPageProps) {
  await setupI18nSSR();

  return <DocumentPageView params={params} />;
}
