'use client';

import { useState } from 'react';

import { TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams';
import type { TeamMemberRole } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';
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

export default function LeaveTeamDialog({ trigger, teamId, teamName, role }: LeaveTeamDialogProps) {
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

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>

          <DialogDescription className="mt-4">
            You are about to leave the following team.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-accent/50 rounded-lg px-4 py-2">
          <div className="flex max-w-xs items-center gap-2">
            <Avatar className="dark:border-border h-12 w-12 border-2 border-solid border-white">
              <AvatarFallback className="text-xs text-gray-400">
                {teamName.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col text-sm">
              <span className="text-foreground/80 font-semibold">{teamName}</span>
              <span className="text-muted-foreground">{TEAM_MEMBER_ROLE_MAP[role]}</span>
            </div>
          </div>
        </div>

        <fieldset disabled={isLeavingTeam}>
          <DialogFooter className="space-x-4">
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
}
