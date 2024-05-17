'use client';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type AcceptTeamInvitationButtonProps = {
  teamId: number;
};

export const AcceptTeamInvitationButton = ({ teamId }: AcceptTeamInvitationButtonProps) => {
  const { toast } = useToast();

  const {
    mutateAsync: acceptTeamInvitation,
    isLoading,
    isSuccess,
  } = trpc.team.acceptTeamInvitation.useMutation({
    onSuccess: () => {
      toast({
        title: 'გილოცავთ!',
        description: 'გუნდის მოწვევა დადასტურებულია',
        duration: 5000,
      });
    },
    onError: () => {
      toast({
        title: 'დაფიქსირდა ხარვეზი',
        variant: 'destructive',
        duration: 10000,
        description: 'ამ დროისთვის ამ გუნდში შესვლა ვერ მოხერხდა.',
      });
    },
  });

  return (
    <Button
      onClick={async () => acceptTeamInvitation({ teamId })}
      loading={isLoading}
      disabled={isLoading || isSuccess}
    >
      დადასტურება
    </Button>
  );
};
