import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { AnimatePresence } from 'framer-motion';

import { trpc } from '@documenso/trpc/react';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';

import { TeamCreateDialog } from '~/components/dialogs/team-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { TeamEmailUsage } from '~/components/general/teams/team-email-usage';
import { TeamInvitations } from '~/components/general/teams/team-invitations';
import { UserSettingsTeamsPageDataTable } from '~/components/tables/user-settings-teams-page-table';

export default function TeamsSettingsPage() {
  const { _ } = useLingui();

  const { data: teamEmail } = trpc.team.getTeamEmailByEmail.useQuery();

  return (
    <div>
      <SettingsHeader
        title={_(msg`Teams`)}
        subtitle={_(msg`Manage all teams you are currently associated with.`)}
      >
        <TeamCreateDialog />
      </SettingsHeader>

      <UserSettingsTeamsPageDataTable />

      <div className="mt-8 space-y-8">
        <AnimatePresence>
          {teamEmail && (
            <AnimateGenericFadeInOut>
              <TeamEmailUsage teamEmail={teamEmail} />
            </AnimateGenericFadeInOut>
          )}
        </AnimatePresence>

        <TeamInvitations />
      </div>
    </div>
  );
}
