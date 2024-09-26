'use client';

import { useState } from 'react';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { AlertTriangle } from 'lucide-react';
import { match } from 'ts-pattern';

import { canExecuteTeamAction } from '@documenso/lib/utils/teams';
import type { TeamMemberRole } from '@documenso/prisma/client';
import { type Subscription, SubscriptionStatus } from '@documenso/prisma/client';
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

export type LayoutBillingBannerProps = {
  subscription: Subscription;
  teamId: number;
  userRole: TeamMemberRole;
};

export const LayoutBillingBanner = ({
  subscription,
  teamId,
  userRole,
}: LayoutBillingBannerProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);

  const { mutateAsync: createBillingPortal, isLoading } =
    trpc.team.createBillingPortal.useMutation();

  const handleCreatePortal = async () => {
    try {
      const sessionUrl = await createBillingPortal({ teamId });

      window.open(sessionUrl, '_blank');

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

  if (subscription.status === SubscriptionStatus.ACTIVE) {
    return null;
  }

  return (
    <>
      <div
        className={cn({
          'bg-yellow-200 text-yellow-900 dark:bg-yellow-400':
            subscription.status === SubscriptionStatus.PAST_DUE,
          'bg-destructive text-destructive-foreground':
            subscription.status === SubscriptionStatus.INACTIVE,
        })}
      >
        <div className="mx-auto flex max-w-screen-xl items-center justify-center gap-x-4 px-4 py-2 text-sm font-medium">
          <div className="flex items-center">
            <AlertTriangle className="mr-2.5 h-5 w-5" />

            {match(subscription.status)
              .with(SubscriptionStatus.PAST_DUE, () => <Trans>Payment overdue</Trans>)
              .with(SubscriptionStatus.INACTIVE, () => <Trans>Teams restricted</Trans>)
              .exhaustive()}
          </div>

          <Button
            variant="ghost"
            className={cn({
              'text-yellow-900 hover:bg-yellow-100 hover:text-yellow-900 dark:hover:bg-yellow-500':
                subscription.status === SubscriptionStatus.PAST_DUE,
              'text-destructive-foreground hover:bg-destructive-foreground hover:text-white':
                subscription.status === SubscriptionStatus.INACTIVE,
            })}
            disabled={isLoading}
            onClick={() => setIsOpen(true)}
            size="sm"
          >
            <Trans>Resolve</Trans>
          </Button>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={(value) => !isLoading && setIsOpen(value)}>
        <DialogContent>
          <DialogTitle>
            <Trans>Payment overdue</Trans>
          </DialogTitle>

          {match(subscription.status)
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

          {canExecuteTeamAction('MANAGE_BILLING', userRole) && (
            <DialogFooter>
              <Button loading={isLoading} onClick={handleCreatePortal}>
                <Trans>Resolve payment</Trans>
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
