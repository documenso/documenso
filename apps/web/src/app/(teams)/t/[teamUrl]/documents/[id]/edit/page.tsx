import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';

import { DocumentEditPageView } from '~/app/(dashboard)/documents/[id]/edit/document-edit-page-view';

export type DocumentPageProps = {
  params: {
    id: string;
    teamUrl: string;
  };
};

export default async function TeamsDocumentEditPage({ params }: DocumentPageProps) {
  setupI18nSSR();

  const { teamUrl } = params;

  const { user } = await getRequiredServerComponentSession();

  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  return <DocumentEditPageView params={params} team={team} />;
}
