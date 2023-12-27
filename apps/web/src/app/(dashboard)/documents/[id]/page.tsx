import DocumentPageComponent from './document-page-component';

export type DocumentPageProps = {
  params: {
    id: string;
  };
};

export default function DocumentPage({ params }: DocumentPageProps) {
  return <DocumentPageComponent params={params} />;
}
