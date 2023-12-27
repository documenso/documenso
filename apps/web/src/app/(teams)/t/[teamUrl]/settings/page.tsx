import { CheckCircle2, Clock } from 'lucide-react';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-teams';
import { recipientInitials } from '@documenso/lib/utils/recipient-formatter';
import { isTokenExpired } from '@documenso/lib/utils/token-verification';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';

import SettingsHeader from '~/components/(dashboard)/settings/layout/header';
import AddTeamEmailDialog from '~/components/(teams)/dialogs/add-team-email-dialog';
import DeleteTeamDialog from '~/components/(teams)/dialogs/delete-team-dialog';
import TransferTeamDialog from '~/components/(teams)/dialogs/transfer-team-dialog';
import UpdateTeamForm from '~/components/(teams)/forms/update-team-form';

import TeamEmailDropdown from './team-email-dropdown';
import { TeamTransferStatus } from './team-transfer-status';

export type TeamsSettingsPageProps = {
  params: {
    teamUrl: string;
  };
};

export default async function TeamsSettingsPage({ params }: TeamsSettingsPageProps) {
  const { teamUrl } = params;

  const session = await getRequiredServerComponentSession();

  const team = await getTeamByUrl({ userId: session.user.id, teamUrl });

  const isTransferVerificationExpired =
    !team.transferVerification || isTokenExpired(team.transferVerification.expiresAt);

  return (
    <div>
      <SettingsHeader title="Team Profile" subtitle="Here you can edit your team's details." />

      <TeamTransferStatus
        teamId={team.id}
        transferVerification={team.transferVerification}
        className="mb-4"
      />

      <UpdateTeamForm teamId={team.id} teamName={team.name} teamUrl={team.url} />

      <section className="space-y-6">
        {(team.teamEmail || team.emailVerification) && (
          <section className="mt-6 rounded-lg bg-gray-50/70 p-6 pb-2">
            <h3 className="font-medium">Team email</h3>

            <p className="text-muted-foreground text-sm">
              You can view documents associated with this email and use this identity when sending
              documents.
            </p>

            <hr className="border-border/50 mt-2" />

            <div className="flex flex-row items-center justify-between py-4">
              <AvatarWithText
                avatarClass="h-12 w-12"
                avatarFallback={recipientInitials(
                  (team.teamEmail?.name || team.emailVerification?.name) ?? '',
                )}
                primaryText={
                  <span className="text-foreground/80 text-sm font-semibold">
                    {team.teamEmail?.name || team.emailVerification?.name}
                  </span>
                }
                secondaryText={
                  <span className="text-sm">
                    {team.teamEmail?.email || team.emailVerification?.email}
                  </span>
                }
              />

              <div className="flex flex-row items-center pr-2">
                <div className="text-muted-foreground mr-4 flex flex-row items-center text-sm xl:mr-8">
                  {team.teamEmail ? (
                    <>
                      <CheckCircle2 className="mr-1.5 text-green-500 dark:text-green-300" />
                      Active
                    </>
                  ) : team.emailVerification && team.emailVerification.expiresAt < new Date() ? (
                    <>
                      <Clock className="mr-1.5 text-yellow-500 dark:text-yellow-200" />
                      Expired
                    </>
                  ) : (
                    team.emailVerification && (
                      <>
                        <Clock className="mr-1.5 text-blue-600 dark:text-blue-300" />
                        Awaiting email confirmation
                      </>
                    )
                  )}
                </div>

                <TeamEmailDropdown team={team} />
              </div>
            </div>
          </section>
        )}

        {!team.teamEmail && !team.emailVerification && (
          <div className="flex flex-row items-center justify-between rounded-lg bg-gray-50/70 p-6">
            <div>
              <h3 className="font-medium">Team email</h3>

              <ul className="text-muted-foreground mt-0.5 list-inside list-disc text-sm">
                <li>Display this name and email when sending documents</li>
                <li>View documents associated with this email</li>
              </ul>
            </div>

            <AddTeamEmailDialog teamId={team.id} />
          </div>
        )}

        {team.ownerUserId === session.user.id && (
          <>
            {isTransferVerificationExpired && (
              <div className="flex flex-row items-center justify-between rounded-lg bg-gray-50/70 p-6">
                <div>
                  <h3 className="font-medium">Transfer team</h3>

                  <p className="text-muted-foreground text-sm">
                    Transfer the ownership of the team to another team member.
                  </p>
                </div>

                <TransferTeamDialog
                  ownerUserId={team.ownerUserId}
                  teamId={team.id}
                  teamName={team.name}
                />
              </div>
            )}

            <div className="flex flex-row items-center justify-between rounded-lg bg-gray-50/70 p-6">
              <div>
                <h3 className="font-medium">Delete team</h3>

                <p className="text-muted-foreground text-sm">
                  This team, and any associated data excluding billing invoices will be permanently
                  deleted.
                </p>
              </div>

              <DeleteTeamDialog teamId={team.id} teamName={team.name} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
