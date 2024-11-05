import React from 'react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';

import type { TemplatesPageViewProps } from '~/app/(dashboard)/templates/templates-page-view';
import { TemplatesPageView } from '~/app/(dashboard)/templates/templates-page-view';

type TeamTemplatesPageProps = {
  searchParams?: TemplatesPageViewProps['searchParams'];
  params: {
    teamUrl: string;
  };
};

export default async function TeamTemplatesPage({
  searchParams = {},
  params,
}: TeamTemplatesPageProps) {
  await setupI18nSSR();

  const { teamUrl } = params;

  const { user } = await getRequiredServerComponentSession();
  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  return <TemplatesPageView searchParams={searchParams} team={team} />;
}
