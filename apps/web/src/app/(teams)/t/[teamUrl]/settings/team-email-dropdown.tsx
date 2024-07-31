'use client';

import { Edit, Loader, Mail, MoreHorizontal, X } from 'lucide-react';

import type { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { trpc } from '@documenso/trpc/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { RemoveTeamEmailDialog } from '~/components/(teams)/dialogs/remove-team-email-dialog';
import { UpdateTeamEmailDialog } from '~/components/(teams)/dialogs/update-team-email-dialog';

export type TeamsSettingsPageProps = {
  team: Awaited<ReturnType<typeof getTeamByUrl>>;
};

export const TeamEmailDropdown = ({ team }: TeamsSettingsPageProps) => {
  const { toast } = useToast();

  const { mutateAsync: resendEmailVerification, isLoading: isResendingEmailVerification } =
    trpc.team.resendTeamEmailVerification.useMutation({
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Email verification has been resent',
          duration: 5000,
        });
      },
      onError: () => {
        toast({
          title: 'Something went wrong',
          variant: 'destructive',
          duration: 10000,
          description: 'Unable to resend verification at this time. Please try again.',
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
            Resend verification
          </DropdownMenuItem>
        )}

        {team.teamEmail && (
          <UpdateTeamEmailDialog
            teamEmail={team.teamEmail}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            }
          />
        )}

        <RemoveTeamEmailDialog
          team={team}
          teamName={team.name}
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <X className="mr-2 h-4 w-4" />
              Remove
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
