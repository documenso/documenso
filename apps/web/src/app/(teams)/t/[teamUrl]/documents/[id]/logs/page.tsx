import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';

import { DocumentLogsPageView } from '~/app/(dashboard)/documents/[id]/logs/document-logs-page-view';

export type TeamDocumentsLogsPageProps = {
  params: {
    id: string;
    teamUrl: string;
  };
};

export default async function TeamsDocumentsLogsPage({ params }: TeamDocumentsLogsPageProps) {
  const { teamUrl } = params;

  const { user } = await getRequiredServerComponentSession();
  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  return <DocumentLogsPageView params={params} team={team} />;
}
