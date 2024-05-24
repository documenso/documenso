import { DocumentEditPageView } from './document-edit-page-view';

export type DocumentPageProps = {
  params: {
    id: string;
  };
};

export default function DocumentEditPage({ params }: DocumentPageProps) {
  return <DocumentEditPageView params={params} />;
}
