'use client';

import { useState } from 'react';

import type { TeamEmail } from '@documenso/prisma/client';
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

  const { toast } = useToast();

  const { mutateAsync: deleteTeamEmail, isLoading: isDeletingTeamEmail } =
    trpc.team.deleteTeamEmail.useMutation({
      onSuccess: () => {
        toast({
          title: 'გილოცავთ!',
          description: 'თქვენ წარმატებით გააუქმეთ წვდომა.',
          duration: 5000,
        });
      },
      onError: () => {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          variant: 'destructive',
          duration: 10000,
          description:
            'წვდომის გაუქმების მცდელობისას დაფიქსირდა ხარვეზი. გთხოვთ, სცადოთ ხელახლა ან დაგვიკავშირდეთ.',
        });
      },
    });

  return (
    <Alert variant="neutral" className="flex flex-row items-center justify-between p-6">
      <div>
        <AlertTitle className="mb-0">გუნდის ელ. ფოსტა</AlertTitle>
        <AlertDescription>
          <p>
            თქვენს ელფოსტას ამჟამად გუნდი იყენებს{' '}
            <span className="font-semibold">{teamEmail.team.name}</span> ({teamEmail.team.url}
            ).
          </p>

          <p className="mt-1">მათ აქვთ უფლება თქვენი სახელით:</p>

          <ul className="mt-0.5 list-inside list-disc">
            <li>აჩვენონ თქვენი სახელი და ელ. ფოსტა დოკუმენტებში</li>
            <li>იხილონ თქვენს ანგარიშზე გამოგზავნილი ყველა დოკუმენტი</li>
          </ul>
        </AlertDescription>
      </div>

      <Dialog open={open} onOpenChange={(value) => !isDeletingTeamEmail && setOpen(value)}>
        <DialogTrigger asChild>
          <Button variant="destructive">წვდომის გაუქმება</Button>
        </DialogTrigger>

        <DialogContent position="center">
          <DialogHeader>
            <DialogTitle>Დარწმუნებული ხართ?</DialogTitle>

            <DialogDescription className="mt-4">
              თქვენ გააუქმებთ გუნდს წვდომას{' '}
              <span className="font-semibold">{teamEmail.team.name}</span> ({teamEmail.team.url})
              თქვენს ელ. ფოსტაზე.
            </DialogDescription>
          </DialogHeader>

          <fieldset disabled={isDeletingTeamEmail}>
            <DialogFooter>
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
    </Alert>
  );
};
