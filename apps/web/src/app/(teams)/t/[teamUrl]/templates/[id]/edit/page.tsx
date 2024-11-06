import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';

import type { TemplateEditPageViewProps } from '~/app/(dashboard)/templates/[id]/edit/template-edit-page-view';
import { TemplateEditPageView } from '~/app/(dashboard)/templates/[id]/edit/template-edit-page-view';

export type TeamsTemplateEditPageProps = {
  params: TemplateEditPageViewProps['params'] & {
    teamUrl: string;
  };
};

export default async function TeamsTemplateEditPage({ params }: TeamsTemplateEditPageProps) {
  await setupI18nSSR();

  const { teamUrl } = params;

  const { user } = await getRequiredServerComponentSession();

  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  return <TemplateEditPageView params={params} team={team} />;
}
