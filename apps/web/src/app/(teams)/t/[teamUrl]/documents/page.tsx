import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';

import type { DocumentsPageViewProps } from '~/app/(dashboard)/documents/documents-page-view';
import { DocumentsPageView } from '~/app/(dashboard)/documents/documents-page-view';

export type TeamsDocumentPageProps = {
  params: {
    teamUrl: string;
  };
  searchParams?: DocumentsPageViewProps['searchParams'];
};

export default async function TeamsDocumentPage({
  params,
  searchParams = {},
}: TeamsDocumentPageProps) {
  const { teamUrl } = params;

  const { user } = await getRequiredServerComponentSession();

  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  return <DocumentsPageView searchParams={searchParams} team={team} />;
}
