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
  const { teamUrl } = params;

  const { user } = await getRequiredServerComponentSession();
  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  return <DocumentPageView params={params} team={team} />;
}
