'use client';

import { useState } from 'react';

import { AnimatePresence, motion } from 'framer-motion';

import type { PriceIntervals } from '@documenso/ee/server-only/stripe/get-prices-by-interval';
import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import { toHumanPrice } from '@documenso/lib/universal/stripe/to-human-price';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent, CardTitle } from '@documenso/ui/primitives/card';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { createCheckout } from './create-checkout.action';

type Interval = keyof PriceIntervals;

const INTERVALS: Interval[] = ['day', 'week', 'month', 'year'];

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const isInterval = (value: unknown): value is Interval => INTERVALS.includes(value as Interval);

const FRIENDLY_INTERVALS: Record<Interval, string> = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
  year: 'Yearly',
};

const MotionCard = motion(Card);

export type BillingPlansProps = {
  prices: PriceIntervals;
};

export const BillingPlans = ({ prices }: BillingPlansProps) => {
  const { toast } = useToast();

  const isMounted = useIsMounted();

  const [interval, setInterval] = useState<Interval>('month');
  const [isFetchingCheckoutSession, setIsFetchingCheckoutSession] = useState(false);

  const onSubscribeClick = async (priceId: string) => {
    try {
      setIsFetchingCheckoutSession(true);

      const url = await createCheckout({ priceId });

      if (!url) {
        throw new Error('Unable to create session');
      }

      window.open(url);
    } catch (_err) {
      toast({
        title: 'Something went wrong',
        description: 'An error occurred while trying to create a checkout session.',
        variant: 'destructive',
      });
    } finally {
      setIsFetchingCheckoutSession(false);
    }
  };

  return (
    <div>
      <Tabs value={interval} onValueChange={(value) => isInterval(value) && setInterval(value)}>
        <TabsList>
          {INTERVALS.map(
            (interval) =>
              prices[interval].length > 0 && (
                <TabsTrigger key={interval} className="min-w-[150px]" value={interval}>
                  {FRIENDLY_INTERVALS[interval]}
                </TabsTrigger>
              ),
          )}
        </TabsList>
      </Tabs>

      <div className="mt-8 grid gap-8 lg:grid-cols-2 2xl:grid-cols-3">
        <AnimatePresence mode="wait">
          {prices[interval].map((price) => (
            <MotionCard
              key={price.id}
              initial={{ opacity: isMounted ? 0 : 1, y: isMounted ? 20 : 0 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
            >
              <CardContent className="flex h-full flex-col p-6">
                <CardTitle>{price.product.name}</CardTitle>

                <div className="text-muted-foreground mt-2 text-lg font-medium">
                  ${toHumanPrice(price.unit_amount ?? 0)} {price.currency.toUpperCase()}{' '}
                  <span className="text-xs">per {interval}</span>
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
                  loading={isFetchingCheckoutSession}
                  onClick={() => void onSubscribeClick(price.id)}
                >
                  Subscribe
                </Button>
              </CardContent>
            </MotionCard>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
