import React from 'react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import type { TemplateEditPageViewProps } from './template-edit-page-view';
import { TemplateEditPageView } from './template-edit-page-view';

type TemplateEditPageProps = Pick<TemplateEditPageViewProps, 'params'>;

export default function TemplateEditPage({ params }: TemplateEditPageProps) {
  setupI18nSSR();

  return <TemplateEditPageView params={params} />;
}
