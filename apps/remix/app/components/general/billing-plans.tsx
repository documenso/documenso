import { useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence, motion } from 'framer-motion';

import type { InternalClaimPlans } from '@documenso/ee/server-only/stripe/get-internal-claim-plans';
import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent, CardTitle } from '@documenso/ui/primitives/card';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { useToast } from '@documenso/ui/primitives/use-toast';

const MotionCard = motion(Card);

export type BillingPlansProps = {
  plans: InternalClaimPlans;
};

export const BillingPlans = ({ plans }: BillingPlansProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const isMounted = useIsMounted();

  const organisation = useCurrentOrganisation();

  const [interval, setInterval] = useState<'monthlyPrice' | 'yearlyPrice'>('yearlyPrice');
  const [checkoutSessionPriceId, setCheckoutSessionPriceId] = useState<string | null>(null);

  const { mutateAsync: createSubscription } = trpc.billing.subscription.create.useMutation();

  const onSubscribeClick = async (priceId: string) => {
    try {
      setCheckoutSessionPriceId(priceId);

      const { redirectUrl } = await createSubscription({
        organisationId: organisation.id,
        priceId,
      });

      window.open(redirectUrl, '_blank');
    } catch (_err) {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`An error occurred while trying to create a checkout session.`),
        variant: 'destructive',
      });
    } finally {
      setCheckoutSessionPriceId(null);
    }
  };

  const pricesToDisplay = useMemo(() => {
    const prices = [];

    for (const plan of Object.values(plans)) {
      if (plan[interval] && plan[interval].isVisibleInApp) {
        prices.push(plan[interval]);
      }
    }

    return prices;
  }, [plans, interval]);

  return (
    <div>
      <Tabs
        value={interval}
        onValueChange={(value) => setInterval(value as 'monthlyPrice' | 'yearlyPrice')}
      >
        <TabsList>
          <TabsTrigger className="min-w-[150px]" value="monthlyPrice">
            <Trans>Monthly</Trans>
          </TabsTrigger>
          <TabsTrigger className="min-w-[150px]" value="yearlyPrice">
            <Trans>Yearly</Trans>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-8 grid gap-8 lg:grid-cols-2 2xl:grid-cols-3">
        <AnimatePresence mode="wait">
          {pricesToDisplay.map((price) => (
            <MotionCard
              key={price.id}
              initial={{ opacity: isMounted ? 0 : 1, y: isMounted ? 20 : 0 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
            >
              <CardContent className="flex h-full flex-col p-6">
                <CardTitle>{price.product.name}</CardTitle>

                <div className="text-muted-foreground mt-2 text-lg font-medium">
                  {price.friendlyPrice + ' '}
                  <span className="text-xs">
                    {interval === 'monthlyPrice' ? (
                      <Trans>per month</Trans>
                    ) : (
                      <Trans>per year</Trans>
                    )}
                  </span>
                </div>

                <div className="text-muted-foreground mt-1.5 text-sm">
                  {price.product.description}
                </div>

                {price.product.features && price.product.features.length > 0 && (
                  <div className="text-muted-foreground mt-4">
                    <div className="text-sm font-medium">Includes:</div>

                    <ul className="mt-1 divide-y text-sm">
                      {price.product.features.map((feature, index) => (
                        <li key={index} className="py-2">
                          {feature.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex-1" />

                <Button
                  className="mt-4"
                  disabled={checkoutSessionPriceId !== null}
                  loading={checkoutSessionPriceId === price.id}
                  onClick={() => void onSubscribeClick(price.id)}
                >
                  <Trans>Subscribe</Trans>
                </Button>
              </CardContent>
            </MotionCard>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
