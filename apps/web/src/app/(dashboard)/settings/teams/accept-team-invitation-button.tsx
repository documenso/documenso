'use client';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type AcceptTeamInvitationButtonProps = {
  teamId: number;
};

export const AcceptTeamInvitationButton = ({ teamId }: AcceptTeamInvitationButtonProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const {
    mutateAsync: acceptTeamInvitation,
    isLoading,
    isSuccess,
  } = trpc.team.acceptTeamInvitation.useMutation({
    onSuccess: () => {
      toast({
        title: _(msg`Success`),
        description: _(msg`Accepted team invitation`),
        duration: 5000,
      });
    },
    onError: () => {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`Unable to join this team at this time.`),
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  return (
    <Button
      onClick={async () => acceptTeamInvitation({ teamId })}
      loading={isLoading}
      disabled={isLoading || isSuccess}
    >
      <Trans>Accept</Trans>
    </Button>
  );
};
