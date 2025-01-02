import { redirect, useParams } from 'react-router';

import { formatDocumentsPath } from '@documenso/lib/utils/teams';

import { useOptionalCurrentTeam } from '~/providers/team';

import { DocumentPageView } from './document-page-view';

export default function DocumentPage() {
  const { id: documentId } = useParams();

  const team = useOptionalCurrentTeam();

  const documentRootPath = formatDocumentsPath(team?.url);

  if (!documentId || Number.isNaN(documentId)) {
    redirect(documentRootPath);
  }

  return <DocumentPageView documentId={Number(documentId)} />;
}
