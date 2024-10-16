import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { TemplatePageView } from './template-page-view';

export type TemplatePageProps = {
  params: {
    id: string;
  };
};

export default function TemplatePage({ params }: TemplatePageProps) {
  setupI18nSSR();

  return <TemplatePageView params={params} />;
}
