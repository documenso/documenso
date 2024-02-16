'use client';

import { useState } from 'react';

import { trpc } from '@documenso/trpc/react';
import { Alert } from '@documenso/ui/primitives/alert';
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

export type DeleteTeamMemberDialogProps = {
  teamId: number;
  teamName: string;
  teamMemberId: number;
  teamMemberName: string;
  teamMemberEmail: string;
  trigger?: React.ReactNode;
};

export const DeleteTeamMemberDialog = ({
  trigger,
  teamId,
  teamName,
  teamMemberId,
  teamMemberName,
  teamMemberEmail,
}: DeleteTeamMemberDialogProps) => {
  const [open, setOpen] = useState(false);

  const { toast } = useToast();

  const { mutateAsync: deleteTeamMembers, isLoading: isDeletingTeamMember } =
    trpc.team.deleteTeamMembers.useMutation({
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'You have successfully removed this user from the team.',
          duration: 5000,
        });

        setOpen(false);
      },
      onError: () => {
        toast({
          title: 'An unknown error occurred',
          variant: 'destructive',
          duration: 10000,
          description:
            'We encountered an unknown error while attempting to remove this user. Please try again later.',
        });
      },
    });

  return (
    <Dialog open={open} onOpenChange={(value) => !isDeletingTeamMember && setOpen(value)}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="secondary">Delete team member</Button>}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>

          <DialogDescription className="mt-4">
            You are about to remove the following user from{' '}
            <span className="font-semibold">{teamName}</span>.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="neutral" padding="tight">
          <AvatarWithText
            avatarClass="h-12 w-12"
            avatarFallback={teamMemberName.slice(0, 1).toUpperCase()}
            primaryText={<span className="font-semibold">{teamMemberName}</span>}
            secondaryText={teamMemberEmail}
          />
        </Alert>

        <fieldset disabled={isDeletingTeamMember}>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>

            <Button
              type="submit"
              variant="destructive"
              loading={isDeletingTeamMember}
              onClick={async () => deleteTeamMembers({ teamId, teamMemberIds: [teamMemberId] })}
            >
              Delete
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
