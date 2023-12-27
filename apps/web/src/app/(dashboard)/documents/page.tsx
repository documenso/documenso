import type { DocumentsPageComponentProps } from './documents-page-component';
import DocumentsPageComponent from './documents-page-component';

export type DocumentsPageProps = {
  searchParams?: DocumentsPageComponentProps['searchParams'];
};

export default function DocumentsPage({ searchParams = {} }: DocumentsPageProps) {
  return <DocumentsPageComponent searchParams={searchParams} />;
}
