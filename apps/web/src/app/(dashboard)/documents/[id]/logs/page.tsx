import { DocumentLogsPageView } from './document-logs-page-view';

export type DocumentsLogsPageProps = {
  params: {
    id: string;
  };
};

export default function DocumentsLogsPage({ params }: DocumentsLogsPageProps) {
  return <DocumentLogsPageView params={params} />;
}
