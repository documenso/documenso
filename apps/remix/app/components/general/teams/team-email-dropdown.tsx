import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Edit, Loader, Mail, MoreHorizontal, X } from 'lucide-react';

import type { getTeamWithEmail } from '@documenso/lib/server-only/team/get-team-email-by-email';
import { trpc } from '@documenso/trpc/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { TeamEmailDeleteDialog } from '~/components/dialogs/team-email-delete-dialog';
import { TeamEmailUpdateDialog } from '~/components/dialogs/team-email-update-dialog';

export type TeamEmailDropdownProps = {
  team: Awaited<ReturnType<typeof getTeamWithEmail>>;
};

export const TeamEmailDropdown = ({ team }: TeamEmailDropdownProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: resendEmailVerification, isPending: isResendingEmailVerification } =
    trpc.team.email.verification.resend.useMutation({
      onSuccess: () => {
        toast({
          title: _(msg`Success`),
          description: _(msg`Email verification has been resent`),
          duration: 5000,
        });
      },
      onError: () => {
        toast({
          title: _(msg`Something went wrong`),
          description: _(msg`Unable to resend verification at this time. Please try again.`),
          variant: 'destructive',
          duration: 10000,
        });
      },
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <MoreHorizontal className="text-muted-foreground h-5 w-5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-52" align="start" forceMount>
        {!team.teamEmail && team.emailVerification && (
          <DropdownMenuItem
            disabled={isResendingEmailVerification}
            onClick={(e) => {
              e.preventDefault();
              void resendEmailVerification({ teamId: team.id });
            }}
          >
            {isResendingEmailVerification ? (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            <Trans>Resend verification</Trans>
          </DropdownMenuItem>
        )}

        {team.teamEmail && (
          <TeamEmailUpdateDialog
            teamEmail={team.teamEmail}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Edit className="mr-2 h-4 w-4" />
                <Trans>Edit</Trans>
              </DropdownMenuItem>
            }
          />
        )}

        <TeamEmailDeleteDialog
          team={team}
          teamName={team.name}
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <X className="mr-2 h-4 w-4" />
              <Trans>Remove</Trans>
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
