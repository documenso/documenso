import React from 'react';

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
  const { teamUrl } = params;

  const { user } = await getRequiredServerComponentSession();
  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  return <TemplatesPageView searchParams={searchParams} team={team} />;
}
