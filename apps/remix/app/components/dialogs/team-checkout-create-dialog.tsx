import { useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader, TagIcon } from 'lucide-react';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type TeamCheckoutCreateDialogProps = {
  pendingTeamId: number | null;
  onClose: () => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const MotionCard = motion(Card);

export const TeamCheckoutCreateDialog = ({
  pendingTeamId,
  onClose,
  ...props
}: TeamCheckoutCreateDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');

  const { data, isLoading } = trpc.team.getTeamPrices.useQuery();

  const { mutateAsync: createCheckout, isPending: isCreatingCheckout } =
    trpc.team.createTeamPendingCheckout.useMutation({
      onSuccess: (checkoutUrl) => {
        window.open(checkoutUrl, '_blank');
        onClose();
      },
      onError: () =>
        toast({
          title: _(msg`Something went wrong`),
          description: _(
            msg`We were unable to create a checkout session. Please try again, or contact support`,
          ),
          variant: 'destructive',
        }),
    });

  const selectedPrice = useMemo(() => {
    if (!data) {
      return null;
    }

    return data[interval];
  }, [data, interval]);

  const handleOnOpenChange = (open: boolean) => {
    if (pendingTeamId === null) {
      return;
    }

    if (!open) {
      onClose();
    }
  };

  if (pendingTeamId === null) {
    return null;
  }

  return (
    <Dialog {...props} open={pendingTeamId !== null} onOpenChange={handleOnOpenChange}>
      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Team checkout</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>Payment is required to finalise the creation of your team.</Trans>
          </DialogDescription>
        </DialogHeader>

        {(isLoading || !data) && (
          <div className="flex h-20 items-center justify-center text-sm">
            {isLoading ? (
              <Loader className="text-documenso h-6 w-6 animate-spin" />
            ) : (
              <p>
                <Trans>Something went wrong</Trans>
              </p>
            )}
          </div>
        )}

        {data && selectedPrice && !isLoading && (
          <div>
            <Tabs
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              onValueChange={(value) => setInterval(value as 'monthly' | 'yearly')}
              value={interval}
              className="mb-4"
            >
              <TabsList className="w-full">
                {[data.monthly, data.yearly].map((price) => (
                  <TabsTrigger key={price.priceId} className="w-full" value={price.interval}>
                    {price.friendlyInterval}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <AnimatePresence mode="wait">
              <MotionCard
                key={selectedPrice.priceId}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
              >
                <CardContent className="flex h-full flex-col p-6">
                  {selectedPrice.interval === 'monthly' ? (
                    <div className="text-muted-foreground text-lg font-medium">
                      $50 USD <span className="text-xs">per month</span>
                    </div>
                  ) : (
                    <div className="text-muted-foreground flex items-center justify-between text-lg font-medium">
                      <span>
                        $480 USD <span className="text-xs">per year</span>
                      </span>
                      <div className="bg-primary text-primary-foreground ml-2 inline-flex flex-row items-center justify-center rounded px-2 py-1 text-xs">
                        <TagIcon className="mr-1 h-4 w-4" />
                        20% off
                      </div>
                    </div>
                  )}

                  <div className="text-muted-foreground mt-1.5 text-sm">
                    <p>
                      <Trans>This price includes minimum 5 seats.</Trans>
                    </p>

                    <p className="mt-1">
                      <Trans>Adding and removing seats will adjust your invoice accordingly.</Trans>
                    </p>
                  </div>
                </CardContent>
              </MotionCard>
            </AnimatePresence>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="secondary"
                disabled={isCreatingCheckout}
                onClick={() => onClose()}
              >
                <Trans>Cancel</Trans>
              </Button>

              <Button
                type="submit"
                loading={isCreatingCheckout}
                onClick={async () =>
                  createCheckout({
                    interval: selectedPrice.interval,
                    pendingTeamId,
                  })
                }
              >
                <Trans>Checkout</Trans>
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
