import { DocumentPageView } from './document-page-view';

export type DocumentPageProps = {
  params: {
    id: string;
  };
};

export default function DocumentPage({ params }: DocumentPageProps) {
  return <DocumentPageView params={params} />;
}
