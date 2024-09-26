import React from 'react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';

import type { TemplatePageViewProps } from '~/app/(dashboard)/templates/[id]/template-page-view';
import { TemplatePageView } from '~/app/(dashboard)/templates/[id]/template-page-view';

type TeamTemplatePageProps = {
  params: TemplatePageViewProps['params'] & {
    teamUrl: string;
  };
};

export default async function TeamTemplatePage({ params }: TeamTemplatePageProps) {
  setupI18nSSR();

  const { teamUrl } = params;

  const { user } = await getRequiredServerComponentSession();
  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  return <TemplatePageView params={params} team={team} />;
}
