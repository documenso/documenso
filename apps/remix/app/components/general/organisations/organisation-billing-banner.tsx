import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { SubscriptionStatus } from '@prisma/client';
import { AlertTriangle } from 'lucide-react';
import { match } from 'ts-pattern';

import { useOptionalCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const OrganisationBillingBanner = () => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);

  const organisation = useOptionalCurrentOrganisation();

  const { mutateAsync: manageSubscription, isPending } =
    trpc.billing.subscription.manage.useMutation();

  const handleCreatePortal = async (organisationId: string) => {
    try {
      const { redirectUrl } = await manageSubscription({ organisationId });

      window.open(redirectUrl, '_blank');

      setIsOpen(false);
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

  const subscriptionStatus = organisation?.subscription?.status;

  if (
    !organisation ||
    subscriptionStatus === undefined ||
    subscriptionStatus === SubscriptionStatus.ACTIVE
  ) {
    return null;
  }

  return (
    <>
      <div
        className={cn({
          'bg-yellow-200 text-yellow-900 dark:bg-yellow-400':
            subscriptionStatus === SubscriptionStatus.PAST_DUE,
          'bg-destructive text-destructive-foreground':
            subscriptionStatus === SubscriptionStatus.INACTIVE,
        })}
      >
        <div className="mx-auto flex max-w-screen-xl items-center justify-center gap-x-4 px-4 py-2 text-sm font-medium">
          <div className="flex items-center">
            <AlertTriangle className="mr-2.5 h-5 w-5" />

            {match(subscriptionStatus)
              .with(SubscriptionStatus.PAST_DUE, () => <Trans>Payment overdue</Trans>)
              .with(SubscriptionStatus.INACTIVE, () => <Trans>Restricted Access</Trans>)
              .exhaustive()}
          </div>

          <Button
            variant="outline"
            className={cn({
              'text-yellow-900 hover:bg-yellow-100 dark:hover:bg-yellow-500':
                subscriptionStatus === SubscriptionStatus.PAST_DUE,
              'text-destructive-foreground hover:bg-destructive-foreground hover:text-white':
                subscriptionStatus === SubscriptionStatus.INACTIVE,
            })}
            disabled={isPending}
            onClick={() => setIsOpen(true)}
            size="sm"
          >
            <Trans>Resolve</Trans>
          </Button>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={(value) => !isPending && setIsOpen(value)}>
        <DialogContent>
          <DialogTitle>
            <Trans>Payment overdue</Trans>
          </DialogTitle>

          {match(subscriptionStatus)
            .with(SubscriptionStatus.PAST_DUE, () => (
              <DialogDescription>
                <Trans>
                  Your payment for teams is overdue. Please settle the payment to avoid any service
                  disruptions.
                </Trans>
              </DialogDescription>
            ))
            .with(SubscriptionStatus.INACTIVE, () => (
              <DialogDescription>
                <Trans>
                  Due to an unpaid invoice, your team has been restricted. Please settle the payment
                  to restore full access to your team.
                </Trans>
              </DialogDescription>
            ))
            .otherwise(() => null)}

          {canExecuteOrganisationAction('MANAGE_BILLING', organisation.currentOrganisationRole) && (
            <DialogFooter>
              <Button loading={isPending} onClick={async () => handleCreatePortal(organisation.id)}>
                <Trans>Resolve payment</Trans>
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
