import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';
import { match } from 'ts-pattern';

/**
 * The reason a team member cannot be removed from the team. When set, the delete
 * dialog explains the reason instead of offering a confirm button.
 */
export type TeamMemberDeleteDisableReason =
  | 'TEAM_OWNER'
  | 'HIGHER_ROLE'
  | 'INHERIT_MEMBER_ENABLED'
  | 'INHERITED_MEMBER';

export type TeamMemberDeleteDialogProps = {
  teamId: number;
  teamName: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  disableReason?: TeamMemberDeleteDisableReason | null;
  trigger?: React.ReactNode;
};

export const TeamMemberDeleteDialog = ({
  trigger,
  teamId,
  teamName,
  memberId,
  memberName,
  memberEmail,
  disableReason,
}: TeamMemberDeleteDialogProps) => {
  const [open, setOpen] = useState(false);

  const { _ } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: deleteTeamMember, isPending: isDeletingTeamMember } = trpc.team.member.delete.useMutation({
    onSuccess: () => {
      toast({
        title: _(msg`Success`),
        description: _(msg`You have successfully removed this user from the team.`),
        duration: 5000,
      });

      setOpen(false);
    },
    onError: () => {
      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to remove this user. Please try again later.`,
        ),
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(value) => !isDeletingTeamMember && setOpen(value)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary">
            <Trans>Remove team member</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>
              You are about to remove the following user from <span className="font-semibold">{teamName}</span>.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        {disableReason ? (
          <Alert variant="neutral">
            <AlertDescription>
              {match(disableReason)
                .with('TEAM_OWNER', () => <Trans>You cannot remove the organisation owner from the team.</Trans>)
                .with('HIGHER_ROLE', () => <Trans>You cannot remove a member with a role higher than your own.</Trans>)
                .with('INHERIT_MEMBER_ENABLED', () => (
                  <Trans>You cannot remove members from this team while the inherit member feature is enabled.</Trans>
                ))
                .with('INHERITED_MEMBER', () => (
                  <Trans>This member is inherited from a group and cannot be removed from the team directly.</Trans>
                ))
                .exhaustive()}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="neutral" padding="tight">
            <AvatarWithText
              avatarClass="h-12 w-12"
              avatarFallback={memberName.slice(0, 1).toUpperCase()}
              primaryText={<span className="font-semibold">{memberName}</span>}
              secondaryText={memberEmail}
            />
          </Alert>
        )}

        <fieldset disabled={isDeletingTeamMember}>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              <Trans>Close</Trans>
            </Button>

            {!disableReason && (
              <Button
                type="submit"
                variant="destructive"
                loading={isDeletingTeamMember}
                onClick={async () => deleteTeamMember({ teamId, memberId })}
              >
                <Trans>Remove</Trans>
              </Button>
            )}
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
