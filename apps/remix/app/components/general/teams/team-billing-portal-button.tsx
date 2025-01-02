import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type TeamBillingPortalButtonProps = {
  buttonProps?: React.ComponentProps<typeof Button>;
  teamId: number;
};

export const TeamBillingPortalButton = ({ buttonProps, teamId }: TeamBillingPortalButtonProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: createBillingPortal, isPending } =
    trpc.team.createBillingPortal.useMutation();

  const handleCreatePortal = async () => {
    try {
      const sessionUrl = await createBillingPortal({ teamId });

      window.open(sessionUrl, '_blank');
    } catch (err) {
      toast({
        title: _(msg`Something went wrong`),
        description: _(
          msg`We are unable to proceed to the billing portal at this time. Please try again, or contact support.`,
        ),
        variant: 'destructive',
        duration: 10000,
      });
    }
  };

  return (
    <Button {...buttonProps} onClick={async () => handleCreatePortal()} loading={isPending}>
      <Trans>Manage subscription</Trans>
    </Button>
  );
};
