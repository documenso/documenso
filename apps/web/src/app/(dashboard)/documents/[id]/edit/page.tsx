import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { DocumentEditPageView } from './document-edit-page-view';

export type DocumentPageProps = {
  params: {
    id: string;
  };
};

export default async function DocumentEditPage({ params }: DocumentPageProps) {
  await setupI18nSSR();

  return <DocumentEditPageView params={params} />;
}
