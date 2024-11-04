import React from 'react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import type { TemplatePageViewProps } from './template-page-view';
import { TemplatePageView } from './template-page-view';

type TemplatePageProps = Pick<TemplatePageViewProps, 'params'>;

export default async function TemplatePage({ params }: TemplatePageProps) {
  await setupI18nSSR();

  return <TemplatePageView params={params} />;
}
