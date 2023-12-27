'use client';

import { AnimatePresence, motion } from 'framer-motion';

import { trpc } from '@documenso/trpc/react';

import SettingsHeader from '~/components/(dashboard)/settings/layout/header';
import CreateTeamDialog from '~/components/(teams)/dialogs/create-team-dialog';
import UserTeamsPageDataTable from '~/components/(teams)/tables/user-teams-page-data-table';

import TeamEmailUsage from './team-email-usage';
import { TeamInvitations } from './team-invitations';

export default function TeamsSettingsPage() {
  const { data: teamEmail } = trpc.team.getTeamEmailByEmail.useQuery();

  return (
    <div>
      <SettingsHeader title="Teams" subtitle="Manage all teams you are currently associated with.">
        <CreateTeamDialog />
      </SettingsHeader>

      <UserTeamsPageDataTable />

      <AnimatePresence>
        {teamEmail && (
          <motion.section
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
          >
            <TeamEmailUsage teamEmail={teamEmail} />
          </motion.section>
        )}
      </AnimatePresence>

      <TeamInvitations />
    </div>
  );
}
