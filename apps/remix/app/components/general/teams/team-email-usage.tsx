import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { TeamEmail } from '@prisma/client';

import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
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

export const TeamEmailUsage = ({ teamEmail }: TeamEmailUsageProps) => {
  const [open, setOpen] = useState(false);

  const { _ } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: deleteTeamEmail, isPending: isDeletingTeamEmail } =
    trpc.team.email.delete.useMutation({
      onSuccess: () => {
        toast({
          title: _(msg`Success`),
          description: _(msg`You have successfully revoked access.`),
          duration: 5000,
        });
      },
      onError: () => {
        toast({
          title: _(msg`Something went wrong`),
          description: _(
            msg`We encountered an unknown error while attempting to revoke access. Please try again or contact support.`,
          ),
          variant: 'destructive',
          duration: 10000,
        });
      },
    });

  return (
    <Alert variant="neutral" className="flex flex-row items-center justify-between p-6">
      <div>
        <AlertTitle className="mb-0">
          <Trans>Team Email</Trans>
        </AlertTitle>
        <AlertDescription>
          <p>
            <Trans>
              Your email is currently being used by team{' '}
              <span className="font-semibold">{teamEmail.team.name}</span> ({teamEmail.team.url}
              ).
            </Trans>
          </p>

          <p className="mt-1">
            <Trans>They have permission on your behalf to:</Trans>
          </p>

          <ul className="mt-0.5 list-inside list-disc">
            <li>
              <Trans>Display your name and email in documents</Trans>
            </li>
            <li>
              <Trans>View all documents sent to your account</Trans>
            </li>
          </ul>
        </AlertDescription>
      </div>

      <Dialog open={open} onOpenChange={(value) => !isDeletingTeamEmail && setOpen(value)}>
        <DialogTrigger asChild>
          <Button variant="destructive">
            <Trans>Revoke access</Trans>
          </Button>
        </DialogTrigger>

        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>
              <Trans>Are you sure?</Trans>
            </DialogTitle>

            <DialogDescription className="mt-4">
              <Trans>
                You are about to revoke access for team{' '}
                <span className="font-semibold">{teamEmail.team.name}</span> ({teamEmail.team.url})
                to use your email.
              </Trans>
            </DialogDescription>
          </DialogHeader>

          <fieldset disabled={isDeletingTeamEmail}>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                <Trans>Cancel</Trans>
              </Button>

              <Button
                type="submit"
                variant="destructive"
                loading={isDeletingTeamEmail}
                onClick={async () => deleteTeamEmail({ teamId: teamEmail.teamId })}
              >
                <Trans>Revoke</Trans>
              </Button>
            </DialogFooter>
          </fieldset>
        </DialogContent>
      </Dialog>
    </Alert>
  );
};
