import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useNavigate } from 'react-router';

import { AppError } from '@documenso/lib/errors/app-error';
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

export type AdminTeamMemberDeleteDialogProps = {
  teamId: number;
  teamName: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
};

export const AdminTeamMemberDeleteDialog = ({
  teamId,
  teamName,
  memberId,
  memberName,
  memberEmail,
}: AdminTeamMemberDeleteDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  const { mutateAsync: deleteTeamMember, isPending } = trpc.admin.teamMember.delete.useMutation({
    onSuccess: async () => {
      toast({
        title: _(msg`Success`),
        description: _(msg`Member has been removed from the team.`),
        duration: 5000,
      });

      setOpen(false);

      // Refresh the page to show updated data
      await navigate(0);
    },
    onError: (err) => {
      const error = AppError.parseError(err);

      console.error(error);

      toast({
        title: _(msg`An error occurred`),
        description: _(msg`We couldn't remove this member. Please try again later.`),
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trans>Remove</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader className="space-y-4">
          <DialogTitle>
            <Trans>Remove Team Member</Trans>
          </DialogTitle>

          <Alert variant="destructive">
            <AlertDescription className="selection:bg-red-100">
              <Trans>This action is not reversible. Please be certain.</Trans>
            </AlertDescription>
          </Alert>
        </DialogHeader>

        <div>
          <DialogDescription>
            <Trans>
              You are about to remove the following user from the team{' '}
              <span className="font-semibold">{teamName}</span>:
            </Trans>
          </DialogDescription>

          <Alert className="mt-4" variant="neutral" padding="tight">
            <AvatarWithText
              avatarClass="h-12 w-12"
              avatarFallback={memberName.slice(0, 1).toUpperCase()}
              primaryText={<span className="font-semibold">{memberName}</span>}
              secondaryText={memberEmail}
            />
          </Alert>
        </div>

        <fieldset disabled={isPending}>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              <Trans>Cancel</Trans>
            </Button>

            <Button
              type="submit"
              variant="destructive"
              loading={isPending}
              onClick={async () => deleteTeamMember({ teamId, memberId })}
            >
              <Trans>Remove member</Trans>
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
