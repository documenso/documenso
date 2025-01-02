import { Trans } from '@lingui/react/macro';
import { CheckCircle2, Clock } from 'lucide-react';
import { P, match } from 'ts-pattern';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { isTokenExpired } from '@documenso/lib/utils/token-verification';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';

import { TeamDeleteDialog } from '~/components/dialogs/team-delete-dialog';
import { TeamEmailAddDialog } from '~/components/dialogs/team-email-add-dialog';
import { TeamTransferDialog } from '~/components/dialogs/team-transfer-dialog';
import { AvatarImageForm } from '~/components/forms/avatar-image';
import { TeamUpdateForm } from '~/components/forms/team-update-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { TeamEmailDropdown } from '~/components/general/teams/team-email-dropdown';
import { TeamTransferStatus } from '~/components/general/teams/team-transfer-status';

import type { Route } from './+types/settings._index';

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  const team = await getTeamByUrl({
    userId: user.id,
    teamUrl: params.teamUrl,
  });

  return {
    team,
  };
}

export default function TeamsSettingsPage({ loaderData }: Route.ComponentProps) {
  const { team } = loaderData;

  const { user } = useSession();

  const isTransferVerificationExpired =
    !team.transferVerification || isTokenExpired(team.transferVerification.expiresAt);

  return (
    <div>
      <SettingsHeader title="General settings" subtitle="Here you can edit your team's details." />

      <TeamTransferStatus
        className="mb-4"
        currentUserTeamRole={team.currentTeamMember.role}
        teamId={team.id}
        transferVerification={team.transferVerification}
      />

      <AvatarImageForm className="mb-8" />

      <TeamUpdateForm teamId={team.id} teamName={team.name} teamUrl={team.url} />

      <section className="mt-6 space-y-6">
        {(team.teamEmail || team.emailVerification) && (
          <Alert className="p-6" variant="neutral">
            <AlertTitle>
              <Trans>Team email</Trans>
            </AlertTitle>

            <AlertDescription className="mr-2">
              <Trans>
                You can view documents associated with this email and use this identity when sending
                documents.
              </Trans>
            </AlertDescription>

            <hr className="border-border/50 mt-2" />

            <div className="flex flex-row items-center justify-between pt-4">
              <AvatarWithText
                avatarClass="h-12 w-12"
                avatarSrc={formatAvatarUrl(team.avatarImageId)}
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
                        <Trans>Active</Trans>
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
                          <Trans>Expired</Trans>
                        </>
                      ),
                    )
                    .with({ emailVerification: P.not(null) }, () => (
                      <>
                        <Clock className="mr-1.5 text-blue-600 dark:text-blue-300" />
                        <Trans>Awaiting email confirmation</Trans>
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
              <AlertTitle>
                <Trans>Team email</Trans>
              </AlertTitle>

              <AlertDescription className="mr-2">
                <ul className="text-muted-foreground mt-0.5 list-inside list-disc text-sm">
                  {/* Feature not available yet. */}
                  {/* <li>Display this name and email when sending documents</li> */}
                  {/* <li>View documents associated with this email</li> */}

                  <span>
                    <Trans>View documents associated with this email</Trans>
                  </span>
                </ul>
              </AlertDescription>
            </div>

            <TeamEmailAddDialog teamId={team.id} />
          </Alert>
        )}

        {team.ownerUserId === user.id && (
          <>
            {isTransferVerificationExpired && (
              <Alert
                className="flex flex-col justify-between p-6 sm:flex-row sm:items-center"
                variant="neutral"
              >
                <div className="mb-4 sm:mb-0">
                  <AlertTitle>
                    <Trans>Transfer team</Trans>
                  </AlertTitle>

                  <AlertDescription className="mr-2">
                    <Trans>Transfer the ownership of the team to another team member.</Trans>
                  </AlertDescription>
                </div>

                <TeamTransferDialog
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
                <AlertTitle>
                  <Trans>Delete team</Trans>
                </AlertTitle>

                <AlertDescription className="mr-2">
                  <Trans>
                    This team, and any associated data excluding billing invoices will be
                    permanently deleted.
                  </Trans>
                </AlertDescription>
              </div>

              <TeamDeleteDialog teamId={team.id} teamName={team.name} />
            </Alert>
          </>
        )}
      </section>
    </div>
  );
}
