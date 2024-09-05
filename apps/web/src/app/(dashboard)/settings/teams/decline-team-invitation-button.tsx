'use client';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type DeclineTeamInvitationButtonProps = {
  teamId: number;
};

export const DeclineTeamInvitationButton = ({ teamId }: DeclineTeamInvitationButtonProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const {
    mutateAsync: declineTeamInvitation,
    isLoading,
    isSuccess,
  } = trpc.team.declineTeamInvitation.useMutation({
    onSuccess: () => {
      toast({
        title: _(msg`Success`),
        description: _(msg`Declined team invitation`),
        duration: 5000,
      });
    },
    onError: () => {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`Unable to decline this team invitation at this time.`),
        variant: 'destructive',
        duration: 10000,
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
      <Trans>Decline</Trans>
    </Button>
  );
};
