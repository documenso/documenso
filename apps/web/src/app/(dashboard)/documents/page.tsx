import type { Metadata } from 'next';

import type { DocumentsPageViewProps } from './documents-page-view';
import { DocumentsPageView } from './documents-page-view';

export type DocumentsPageProps = {
  searchParams?: DocumentsPageViewProps['searchParams'];
};

export const metadata: Metadata = {
  title: 'Documents',
};

export default function DocumentsPage({ searchParams = {} }: DocumentsPageProps) {
  return <DocumentsPageView searchParams={searchParams} />;
}
