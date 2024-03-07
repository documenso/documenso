'use client';

import { useState } from 'react';

import { TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams';
import type { TeamMemberRole } from '@documenso/prisma/client';
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

export type LeaveTeamDialogProps = {
  teamId: number;
  teamName: string;
  role: TeamMemberRole;
  trigger?: React.ReactNode;
};

export const LeaveTeamDialog = ({ trigger, teamId, teamName, role }: LeaveTeamDialogProps) => {
  const [open, setOpen] = useState(false);

  const { toast } = useToast();

  const { mutateAsync: leaveTeam, isLoading: isLeavingTeam } = trpc.team.leaveTeam.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'You have successfully left this team.',
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
          'We encountered an unknown error while attempting to leave this team. Please try again later.',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(value) => !isLeavingTeam && setOpen(value)}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="destructive">Leave team</Button>}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>

          <DialogDescription className="mt-4">
            You are about to leave the following team.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="neutral" padding="tight">
          <AvatarWithText
            avatarClass="h-12 w-12"
            avatarFallback={teamName.slice(0, 1).toUpperCase()}
            primaryText={teamName}
            secondaryText={TEAM_MEMBER_ROLE_MAP[role]}
          />
        </Alert>

        <fieldset disabled={isLeavingTeam}>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>

            <Button
              type="submit"
              variant="destructive"
              loading={isLeavingTeam}
              onClick={async () => leaveTeam({ teamId })}
            >
              Leave
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
