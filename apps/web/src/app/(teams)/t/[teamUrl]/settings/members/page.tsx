import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { InviteTeamMembersDialog } from '~/components/(teams)/dialogs/invite-team-member-dialog';
import { TeamsMemberPageDataTable } from '~/components/(teams)/tables/teams-member-page-data-table';

export type TeamsSettingsMembersPageProps = {
  params: {
    teamUrl: string;
  };
};

export default async function TeamsSettingsMembersPage({ params }: TeamsSettingsMembersPageProps) {
  await setupI18nSSR();

  const { _ } = useLingui();
  const { teamUrl } = params;

  const session = await getRequiredServerComponentSession();

  const team = await getTeamByUrl({ userId: session.user.id, teamUrl });

  return (
    <div>
      <SettingsHeader
        title={_(msg`Members`)}
        subtitle={_(msg`Manage the members or invite new members.`)}
      >
        <InviteTeamMembersDialog
          teamId={team.id}
          currentUserTeamRole={team.currentTeamMember.role}
        />
      </SettingsHeader>

      <TeamsMemberPageDataTable
        currentUserTeamRole={team.currentTeamMember.role}
        teamId={team.id}
        teamName={team.name}
        teamOwnerUserId={team.ownerUserId}
      />
    </div>
  );
}
