import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type PendingUserTeamsDataTableActionsProps = {
  className?: string;
  pendingTeamId: number;
  onPayClick: (pendingTeamId: number) => void;
};

export const PendingUserTeamsDataTableActions = ({
  className,
  pendingTeamId,
  onPayClick,
}: PendingUserTeamsDataTableActionsProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: deleteTeamPending, isLoading: deletingTeam } =
    trpc.team.deleteTeamPending.useMutation({
      onSuccess: () => {
        toast({
          title: _(msg`Success`),
          description: _(msg`Pending team deleted.`),
        });
      },
      onError: () => {
        toast({
          title: _(msg`Something went wrong`),
          description: _(
            msg`We encountered an unknown error while attempting to delete the pending team. Please try again later.`,
          ),
          duration: 10000,
          variant: 'destructive',
        });
      },
    });

  return (
    <fieldset disabled={deletingTeam} className={cn('flex justify-end space-x-2', className)}>
      <Button variant="outline" onClick={() => onPayClick(pendingTeamId)}>
        <Trans>Pay</Trans>
      </Button>

      <Button
        variant="destructive"
        loading={deletingTeam}
        onClick={async () => deleteTeamPending({ pendingTeamId: pendingTeamId })}
      >
        <Trans>Remove</Trans>
      </Button>
    </fieldset>
  );
};
