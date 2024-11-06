import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { TemplatePageView } from './template-page-view';

export type TemplatePageProps = {
  params: {
    id: string;
  };
};

export default async function TemplatePage({ params }: TemplatePageProps) {
  await setupI18nSSR();

  return <TemplatePageView params={params} />;
}
