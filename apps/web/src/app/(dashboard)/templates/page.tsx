import React from 'react';

import type { Metadata } from 'next';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { TemplatesPageView } from './templates-page-view';
import type { TemplatesPageViewProps } from './templates-page-view';

type TemplatesPageProps = {
  searchParams?: TemplatesPageViewProps['searchParams'];
};

export const metadata: Metadata = {
  title: 'Templates',
};

export default async function TemplatesPage({ searchParams = {} }: TemplatesPageProps) {
  await setupI18nSSR();

  return <TemplatesPageView searchParams={searchParams} />;
}
