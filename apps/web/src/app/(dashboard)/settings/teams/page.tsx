'use client';

import { AnimatePresence, motion } from 'framer-motion';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

import SettingsHeader from '~/components/(dashboard)/settings/layout/header';
import CreateTeamDialog from '~/components/(teams)/dialogs/create-team-dialog';
import UserTeamsPageDataTable from '~/components/(teams)/tables/user-teams-page-data-table';

import { TeamInvitations } from './team-invitations';

export default function TeamsSettingsPage() {
  const { toast } = useToast();

  const { data: teamEmail } = trpc.team.getTeamEmailByEmail.useQuery();

  const { mutateAsync: deleteTeamEmail, isLoading: isDeletingTeamEmail } =
    trpc.team.deleteTeamEmail.useMutation({
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'You have successfully revoked access.',
          duration: 5000,
        });
      },
      onError: () => {
        toast({
          title: 'Something went wrong',
          variant: 'destructive',
          duration: 10000,
          description:
            'We encountered an unknown error while attempting to revoke access. Please try again or contact support.',
        });
      },
    });

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
            <div className="mt-8 flex flex-row items-center justify-between rounded-lg bg-gray-50/70 p-6">
              <div className="text-sm">
                <h3 className="text-base font-medium">Team email</h3>

                <p className="text-muted-foreground">
                  Your email is currently being used by team{' '}
                  <span className="font-semibold">{teamEmail.team.name}</span> ({teamEmail.team.url}
                  ).
                </p>

                <p className="text-muted-foreground mt-1">
                  They have permission on your behalf to:
                </p>

                <ul className="text-muted-foreground mt-0.5 list-inside list-disc">
                  <li>Display your name and email in documents</li>
                  <li>View all documents sent to your account</li>
                </ul>
              </div>

              {/* Todo: Teams - Add 'are you sure'. */}
              <Button
                variant="destructive"
                loading={isDeletingTeamEmail}
                onClick={async () => deleteTeamEmail({ teamId: teamEmail.team.id })}
              >
                Revoke access
              </Button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <TeamInvitations />
    </div>
  );
}
