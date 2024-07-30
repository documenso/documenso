'use client';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DeclineTeamInvitationButtonProps = {
  teamId: number;
};

export const DeclineTeamInvitationButton = ({ teamId }: DeclineTeamInvitationButtonProps) => {
  const { toast } = useToast();

  const {
    mutateAsync: declineTeamInvitation,
    isLoading,
    isSuccess,
  } = trpc.team.declineTeamInvitation.useMutation({
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Declined team invitation',
        duration: 5000,
      });
    },
    onError: () => {
      toast({
        title: 'Something went wrong',
        variant: 'destructive',
        duration: 10000,
        description: 'Unable to decline this team invitation at this time.',
      });
    },
  });

  return (
    <Button
      onClick={async () => declineTeamInvitation({ teamId })}
      loading={isLoading}
      disabled={isLoading || isSuccess}
      variant="ghost"
    >
      Decline
    </Button>
  );
};
