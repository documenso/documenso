import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
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
  await setupI18nSSR();

  const { teamUrl } = params;

  const { user } = await getRequiredServerComponentSession();
  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  return <DocumentLogsPageView params={params} team={team} />;
}
