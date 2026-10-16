import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { buildTeamWhereQuery, canExecuteTeamAction } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { CheckCircle2, Clock, EditIcon, LoaderIcon, MailIcon, MoreHorizontalIcon, XIcon } from 'lucide-react';
import { redirect } from 'react-router';
import { match, P } from 'ts-pattern';
import { TeamDeleteDialog } from '~/components/dialogs/team-delete-dialog';
import { TeamEmailAddDialog } from '~/components/dialogs/team-email-add-dialog';
import { TeamEmailDeleteDialog } from '~/components/dialogs/team-email-delete-dialog';
import { TeamEmailUpdateDialog } from '~/components/dialogs/team-email-update-dialog';
import { AvatarImageForm } from '~/components/forms/avatar-image';
import { TeamUpdateForm } from '~/components/forms/team-update-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { useCurrentTeam } from '~/providers/team';
import type { Route } from './+types/settings.general';

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  if (!user || !params.teamUrl) {
    throw redirect('/');
  }

  const team = await prisma.team.findUnique({
    where: {
      ...buildTeamWhereQuery({
        teamId: undefined,
        userId: user.id,
        roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
      }),
      url: params.teamUrl,
    },
    include: {
      teamEmail: {
        select: {
          email: true,
          name: true,
        },
      },
      emailVerification: {
        select: {
          email: true,
          name: true,
          expiresAt: true,
        },
      },
    },
  });

  if (!team) {
    throw redirect('/');
  }

  return {
    teamEmail: team.teamEmail
      ? {
          email: team.teamEmail?.email,
          name: team.teamEmail.name,
        }
      : null,
    emailVerification: team.emailVerification
      ? {
          email: team.emailVerification?.email,
          name: team.emailVerification.name,
          expiresAt: team.emailVerification.expiresAt,
        }
      : null,
  };
}

export default function TeamsSettingsPage({ loaderData }: Route.ComponentProps) {
  const { t } = useLingui();
  const { toast } = useToast();

  const { teamEmail, emailVerification } = loaderData;

  const team = useCurrentTeam();

  const { mutateAsync: resendEmailVerification, isPending: isResendingEmailVerification } =
    trpc.team.email.verification.resend.useMutation({
      onSuccess: () => {
        toast({
          title: t`Success`,
          description: t`Email verification has been resent`,
          duration: 5000,
        });
      },
      onError: () => {
        toast({
          title: t`Something went wrong`,
          description: t`Unable to resend verification at this time. Please try again.`,
          variant: 'destructive',
          duration: 10000,
        });
      },
    });

  return (
    <div>
      <SettingsHeader title={t`General settings`} subtitle={t`Here you can edit your team's details.`} />

      <AvatarImageForm team={team} className="mb-8" />

      <TeamUpdateForm teamId={team.id} teamName={team.name} teamUrl={team.url} />

      <section className="mt-6 space-y-6">
        {(teamEmail || emailVerification) && (
          <Alert className="p-6" variant="neutral">
            <AlertTitle>
              <Trans>Team email</Trans>
            </AlertTitle>

            <AlertDescription className="mr-2">
              <Trans>
                You can view documents associated with this email and use this identity when sending documents.
              </Trans>
            </AlertDescription>

            <hr className="mt-2 border-border/50" />

            <div className="flex flex-row items-center justify-between pt-4">
              <AvatarWithText
                avatarClass="h-12 w-12"
                avatarSrc={formatAvatarUrl(team.avatarImageId)}
                avatarFallback={extractInitials((teamEmail?.name || emailVerification?.name) ?? '')}
                primaryText={
                  <span className="font-semibold text-foreground/80 text-sm">
                    {teamEmail?.name || emailVerification?.name}
                  </span>
                }
                secondaryText={<span className="text-sm">{teamEmail?.email || emailVerification?.email}</span>}
              />

              <div className="flex flex-row items-center pr-2">
                <div className="mr-4 flex flex-row items-center text-muted-foreground text-sm xl:mr-8">
                  {match({
                    teamEmail,
                    emailVerification: emailVerification,
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
                          (emailVerification) => emailVerification && emailVerification?.expiresAt < new Date(),
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

                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <MoreHorizontalIcon className="h-5 w-5 text-muted-foreground" />
                  </DropdownMenuTrigger>

                  <DropdownMenuContent className="w-52" align="start" forceMount>
                    {!teamEmail && emailVerification && (
                      <DropdownMenuItem
                        disabled={isResendingEmailVerification}
                        onClick={(e) => {
                          e.preventDefault();
                          void resendEmailVerification({ teamId: team.id });
                        }}
                      >
                        {isResendingEmailVerification ? (
                          <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <MailIcon className="mr-2 h-4 w-4" />
                        )}
                        <Trans>Resend verification</Trans>
                      </DropdownMenuItem>
                    )}

                    {teamEmail && (
                      <TeamEmailUpdateDialog
                        teamId={team.id}
                        teamEmail={teamEmail}
                        trigger={
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <EditIcon className="mr-2 h-4 w-4" />
                            <Trans>Edit</Trans>
                          </DropdownMenuItem>
                        }
                      />
                    )}

                    <TeamEmailDeleteDialog
                      team={team}
                      teamEmail={teamEmail}
                      emailVerification={emailVerification}
                      teamName={team.name}
                      trigger={
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <XIcon className="mr-2 h-4 w-4" />
                          <Trans>Remove</Trans>
                        </DropdownMenuItem>
                      }
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </Alert>
        )}

        {!teamEmail && !emailVerification && (
          <Alert className="flex flex-col justify-between p-6 sm:flex-row sm:items-center" variant="neutral">
            <div className="mb-4 sm:mb-0">
              <AlertTitle>
                <Trans>Team email</Trans>
              </AlertTitle>

              <AlertDescription className="mr-2">
                <ul className="mt-0.5 list-inside list-disc text-muted-foreground text-sm">
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

        {canExecuteTeamAction('MANAGE_TEAM', team.currentTeamRole) && (
          <Alert className="flex flex-col justify-between p-6 sm:flex-row sm:items-center" variant="neutral">
            <div className="mb-4 sm:mb-0">
              <AlertTitle>
                <Trans>Delete team</Trans>
              </AlertTitle>

              <AlertDescription className="mr-2">
                <Trans>
                  This team, and any associated data excluding billing invoices will be permanently deleted.
                </Trans>
              </AlertDescription>
            </div>

            <TeamDeleteDialog teamId={team.id} teamName={team.name} redirectTo="/dashboard" />
          </Alert>
        )}
      </section>
    </div>
  );
}
