import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type BillingPortalButtonProps = {
  buttonProps?: React.ComponentProps<typeof Button>;
  children?: React.ReactNode;
};

export const BillingPortalButton = ({ buttonProps, children }: BillingPortalButtonProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: createBillingPortal, isPending } =
    trpc.profile.createBillingPortal.useMutation({
      onSuccess: (sessionUrl) => {
        window.open(sessionUrl, '_blank');
      },
      onError: (err) => {
        let description = _(
          msg`We are unable to proceed to the billing portal at this time. Please try again, or contact support.`,
        );

        if (err.message === 'CUSTOMER_NOT_FOUND') {
          description = _(
            msg`You do not currently have a customer record, this should not happen. Please contact support for assistance.`,
          );
        }

        toast({
          title: _(msg`Something went wrong`),
          description,
          variant: 'destructive',
          duration: 10000,
        });
      },
    });

  return (
    <Button {...buttonProps} onClick={async () => createBillingPortal()} loading={isPending}>
      {children || <Trans>Manage Subscription</Trans>}
    </Button>
  );
};
