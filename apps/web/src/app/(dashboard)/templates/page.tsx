import React from 'react';

import type { Metadata } from 'next';

import { TemplatesPageView } from './templates-page-view';
import type { TemplatesPageViewProps } from './templates-page-view';

type TemplatesPageProps = {
  searchParams?: TemplatesPageViewProps['searchParams'];
};

export const metadata: Metadata = {
  title: 'Templates',
};

export default function TemplatesPage({ searchParams = {} }: TemplatesPageProps) {
  return <TemplatesPageView searchParams={searchParams} />;
}
