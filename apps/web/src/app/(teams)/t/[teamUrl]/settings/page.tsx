import { CheckCircle2, Clock } from 'lucide-react';
import { P, match } from 'ts-pattern';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { isTokenExpired } from '@documenso/lib/utils/token-verification';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { AddTeamEmailDialog } from '~/components/(teams)/dialogs/add-team-email-dialog';
import { DeleteTeamDialog } from '~/components/(teams)/dialogs/delete-team-dialog';
import { TransferTeamDialog } from '~/components/(teams)/dialogs/transfer-team-dialog';
import { UpdateTeamForm } from '~/components/(teams)/forms/update-team-form';

import { TeamEmailDropdown } from './team-email-dropdown';
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
        className="mb-4"
        currentUserTeamRole={team.currentTeamMember.role}
        teamId={team.id}
        transferVerification={team.transferVerification}
      />

      <UpdateTeamForm teamId={team.id} teamName={team.name} teamUrl={team.url} />

      <section className="mt-6 space-y-6">
        {(team.teamEmail || team.emailVerification) && (
          <Alert className="p-6" variant="neutral">
            <AlertTitle>Team email</AlertTitle>

            <AlertDescription className="mr-2">
              You can view documents associated with this email and use this identity when sending
              documents.
            </AlertDescription>

            <hr className="border-border/50 mt-2" />

            <div className="flex flex-row items-center justify-between pt-4">
              <AvatarWithText
                avatarClass="h-12 w-12"
                avatarFallback={extractInitials(
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
                  {match({
                    teamEmail: team.teamEmail,
                    emailVerification: team.emailVerification,
                  })
                    .with({ teamEmail: P.not(null) }, () => (
                      <>
                        <CheckCircle2 className="mr-1.5 text-green-500 dark:text-green-300" />
                        Active
                      </>
                    ))
                    .with(
                      {
                        emailVerification: P.when(
                          (emailVerification) =>
                            emailVerification && emailVerification?.expiresAt < new Date(),
                        ),
                      },
                      () => (
                        <>
                          <Clock className="mr-1.5 text-yellow-500 dark:text-yellow-200" />
                          Expired
                        </>
                      ),
                    )
                    .with({ emailVerification: P.not(null) }, () => (
                      <>
                        <Clock className="mr-1.5 text-blue-600 dark:text-blue-300" />
                        Awaiting email confirmation
                      </>
                    ))
                    .otherwise(() => null)}
                </div>

                <TeamEmailDropdown team={team} />
              </div>
            </div>
          </Alert>
        )}

        {!team.teamEmail && !team.emailVerification && (
          <Alert
            className="flex flex-col justify-between p-6 sm:flex-row sm:items-center"
            variant="neutral"
          >
            <div className="mb-4 sm:mb-0">
              <AlertTitle>Team email</AlertTitle>

              <AlertDescription className="mr-2">
                <ul className="text-muted-foreground mt-0.5 list-inside list-disc text-sm">
                  {/* Feature not available yet. */}
                  {/* <li>Display this name and email when sending documents</li> */}
                  {/* <li>View documents associated with this email</li> */}

                  <span>View documents associated with this email</span>
                </ul>
              </AlertDescription>
            </div>

            <AddTeamEmailDialog teamId={team.id} />
          </Alert>
        )}

        {team.ownerUserId === session.user.id && (
          <>
            {isTransferVerificationExpired && (
              <Alert
                className="flex flex-col justify-between p-6 sm:flex-row sm:items-center"
                variant="neutral"
              >
                <div className="mb-4 sm:mb-0">
                  <AlertTitle>Transfer team</AlertTitle>

                  <AlertDescription className="mr-2">
                    Transfer the ownership of the team to another team member.
                  </AlertDescription>
                </div>

                <TransferTeamDialog
                  ownerUserId={team.ownerUserId}
                  teamId={team.id}
                  teamName={team.name}
                />
              </Alert>
            )}

            <Alert
              className="flex flex-col justify-between p-6 sm:flex-row sm:items-center"
              variant="neutral"
            >
              <div className="mb-4 sm:mb-0">
                <AlertTitle>Delete team</AlertTitle>

                <AlertDescription className="mr-2">
                  This team, and any associated data excluding billing invoices will be permanently
                  deleted.
                </AlertDescription>
              </div>

              <DeleteTeamDialog teamId={team.id} teamName={team.name} />
            </Alert>
          </>
        )}
      </section>
    </div>
  );
}
