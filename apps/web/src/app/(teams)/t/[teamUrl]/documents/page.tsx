import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-teams';

import type { DocumentsPageComponentProps } from '~/app/(dashboard)/documents/documents-page-component';
import DocumentsPageComponent from '~/app/(dashboard)/documents/documents-page-component';

export type TeamsDocumentPageProps = {
  params: {
    teamUrl: string;
  };
  searchParams?: DocumentsPageComponentProps['searchParams'];
};

export default async function TeamsDocumentPage({
  params,
  searchParams = {},
}: TeamsDocumentPageProps) {
  const { teamUrl } = params;

  const { user } = await getRequiredServerComponentSession();
  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  return <DocumentsPageComponent searchParams={searchParams} team={team} />;
}
