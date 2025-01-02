import { redirect, useParams } from 'react-router';

import { formatDocumentsPath } from '@documenso/lib/utils/teams';

import { useOptionalCurrentTeam } from '~/providers/team';

import { DocumentLogsPageView } from './document-logs-page-view';

export default function DocumentsLogsPage() {
  const { id: documentId } = useParams();

  const team = useOptionalCurrentTeam();

  const documentRootPath = formatDocumentsPath(team?.url);

  if (!documentId || Number.isNaN(documentId)) {
    redirect(documentRootPath);
  }

  return <DocumentLogsPageView documentId={Number(documentId)} />;
}
