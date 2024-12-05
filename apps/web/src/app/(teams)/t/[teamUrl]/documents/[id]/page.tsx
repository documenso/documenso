import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';

import { DocumentPageView } from '~/app/(dashboard)/documents/[id]/document-page-view';

export type DocumentPageProps = {
  params: {
    id: string;
    teamUrl: string;
  };
};

export default async function DocumentPage({ params }: DocumentPageProps) {
  await setupI18nSSR();

  const { teamUrl } = params;

  const { user } = await getRequiredServerComponentSession();
  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  return <DocumentPageView params={params} team={team} />;
}
