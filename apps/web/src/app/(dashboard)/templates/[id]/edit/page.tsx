import React from 'react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import type { TemplateEditPageViewProps } from './template-edit-page-view';
import { TemplateEditPageView } from './template-edit-page-view';

type TemplateEditPageProps = Pick<TemplateEditPageViewProps, 'params'>;

export default async function TemplateEditPage({ params }: TemplateEditPageProps) {
  await setupI18nSSR();

  return <TemplateEditPageView params={params} />;
}
