'use client';

import { useState } from 'react';

import type { TeamEmail } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
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

export type TeamEmailUsageProps = {
  teamEmail: TeamEmail & { team: { name: string; url: string } };
};

export default function TeamEmailUsage({ teamEmail }: TeamEmailUsageProps) {
  const [open, setOpen] = useState(false);

  const { toast } = useToast();

  const { mutateAsync: deleteTeamEmail, isLoading: isDeletingTeamEmail } =
    trpc.team.deleteTeamEmail.useMutation({
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'You have successfully revoked access.',
          duration: 5000,
        });
      },
      onError: () => {
        toast({
          title: 'Something went wrong',
          variant: 'destructive',
          duration: 10000,
          description:
            'We encountered an unknown error while attempting to revoke access. Please try again or contact support.',
        });
      },
    });

  return (
    <div className="mt-8 flex flex-row items-center justify-between rounded-lg bg-gray-50/70 p-6">
      <div className="text-sm">
        <h3 className="text-base font-medium">Team email</h3>

        <p className="text-muted-foreground">
          Your email is currently being used by team{' '}
          <span className="font-semibold">{teamEmail.team.name}</span> ({teamEmail.team.url}
          ).
        </p>

        <p className="text-muted-foreground mt-1">They have permission on your behalf to:</p>

        <ul className="text-muted-foreground mt-0.5 list-inside list-disc">
          <li>Display your name and email in documents</li>
          <li>View all documents sent to your account</li>
        </ul>
      </div>

      <Dialog open={open} onOpenChange={(value) => !isDeletingTeamEmail && setOpen(value)}>
        <DialogTrigger asChild>
          <Button variant="destructive">Revoke access</Button>
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>

            <DialogDescription className="mt-4">
              You are about to revoke access for team{' '}
              <span className="font-semibold">{teamEmail.team.name}</span> ({teamEmail.team.url}) to
              use your email.
            </DialogDescription>
          </DialogHeader>

          <fieldset disabled={isDeletingTeamEmail}>
            <DialogFooter className="space-x-4">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>

              <Button
                type="submit"
                variant="destructive"
                loading={isDeletingTeamEmail}
                onClick={async () => deleteTeamEmail({ teamId: teamEmail.teamId })}
              >
                Revoke
              </Button>
            </DialogFooter>
          </fieldset>
        </DialogContent>
      </Dialog>
    </div>
  );
}
