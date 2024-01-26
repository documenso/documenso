import React from 'react';

import type { TemplatePageViewProps } from './template-page-view';
import TemplatePageView from './template-page-view';

type TemplatePageProps = {
  params: TemplatePageViewProps['params'];
};

export default function TemplatePage({ params }: TemplatePageProps) {
  return <TemplatePageView params={params} />;
}
