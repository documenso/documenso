'use client';

import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { AnimatePresence } from 'framer-motion';

import { trpc } from '@documenso/trpc/react';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { CreateTeamDialog } from '~/components/(teams)/dialogs/create-team-dialog';
import { UserSettingsTeamsPageDataTable } from '~/components/(teams)/tables/user-settings-teams-page-data-table';

import { TeamEmailUsage } from './team-email-usage';
import { TeamInvitations } from './team-invitations';

export default function TeamsSettingsPage() {
  const { _ } = useLingui();

  const { data: teamEmail } = trpc.team.getTeamEmailByEmail.useQuery();

  return (
    <div>
      <SettingsHeader
        title={_(msg`Teams`)}
        subtitle={_(msg`Manage all teams you are currently associated with.`)}
      >
        <CreateTeamDialog />
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
