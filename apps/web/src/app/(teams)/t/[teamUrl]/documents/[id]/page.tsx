import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-teams';

import DocumentPageComponent from '~/app/(dashboard)/documents/[id]/document-page-component';

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

  return <DocumentPageComponent params={params} team={team} />;
}
