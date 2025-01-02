import { redirect, useParams } from 'react-router';

import { formatDocumentsPath } from '@documenso/lib/utils/teams';

import { useOptionalCurrentTeam } from '~/providers/team';

import { DocumentEditPageView } from './document-edit-page-view';

export default function DocumentEditPage() {
  const { id: documentId } = useParams();

  const team = useOptionalCurrentTeam();

  const documentRootPath = formatDocumentsPath(team?.url);

  if (!documentId || Number.isNaN(documentId)) {
    redirect(documentRootPath);
  }

  return <DocumentEditPageView documentId={Number(documentId)} />;
}
