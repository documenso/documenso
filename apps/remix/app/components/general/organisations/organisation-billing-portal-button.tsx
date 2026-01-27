import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type OrganisationBillingPortalButtonProps = {
  buttonProps?: React.ComponentProps<typeof Button>;
};

export const OrganisationBillingPortalButton = ({
  buttonProps,
}: OrganisationBillingPortalButtonProps) => {
  const { organisations } = useSession();

  const organisation = useCurrentOrganisation();

  const { _ } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: manageSubscription, isPending } =
    trpc.enterprise.billing.subscription.manage.useMutation();

  const canManageBilling = canExecuteOrganisationAction(
    'MANAGE_BILLING',
    organisation.currentOrganisationRole,
  );

  const handleCreatePortal = async () => {
    try {
      const { redirectUrl } = await manageSubscription({
        organisationId: organisation.id,
        isPersonalLayoutMode: isPersonalLayout(organisations),
      });

      window.open(redirectUrl, '_blank');
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
    <Button
      {...buttonProps}
      onClick={async () => handleCreatePortal()}
      loading={isPending}
      disabled={!canManageBilling}
    >
      <Trans>Manage billing</Trans>
    </Button>
  );
};
