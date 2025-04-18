import { Card, CardContent, CardFooter } from '@documenso/ui/primitives/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { Button } from '@documenso/ui/primitives/button';
import { Check } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@documenso/ui/lib/utils';
import { useLingui } from '@lingui/react';
import { useState } from 'react';

type Interval = 'month' | 'year';

export type PriceIntervals = {
  monthly: Array<{
    id: string;
    product: {
      name: string;
      description: string;
      features: string[];
    };
    unit_amount: number;
    interval: string;
    currency: string;
  }>;
  yearly: Array<{
    id: string;
    product: {
      name: string;
      description: string;
      features: string[];
    };
    unit_amount: number;
    interval: string;
    currency: string;
  }>;
};

const isInterval = (value: unknown): value is Interval => {
  return value === 'month' || value === 'year';
};

export type BillingPlansProps = {
  prices: PriceIntervals;
};

export const BillingPlans = ({ prices }: BillingPlansProps) => {
  const { _ } = useLingui();
  const [interval, setInterval] = useState<Interval>('month');

  const handleCheckoutClick = async (priceId: string) => {
    const redirectUrl = `/?type=billing&priceId=${priceId}`;

    // Simulate a URL object for compatibility
    const url = {
      url: redirectUrl,
    };

    window.open(url.url);
  };

  return (
    <div className="my-8 flex flex-col gap-y-8">
      <Tabs value={interval as string} onValueChange={(value) => isInterval(value) && setInterval(value)}>
        <TabsList className="mx-auto">
          {prices.monthly.length > 0 && (
            <TabsTrigger key="month" className="min-w-[150px]" value="month">
              <Trans>Monthly</Trans>
            </TabsTrigger>
          )}

          {prices.yearly.length > 0 && (
            <TabsTrigger key="year" className="min-w-[150px]" value="year">
              <Trans>Yearly</Trans>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="month">
          {prices.monthly.map((price) => (
            <Card key={price.id} className="relative mt-4 flex flex-col overflow-hidden">
              <CardContent className="grid flex-1 gap-4 p-6">
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-bold">{price.product.name}</h3>
                  <p className="text-sm text-muted-foreground">{price.product.description}</p>
                </div>

                <div className="mt-4 flex flex-col gap-1">
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold">
                      {(price.unit_amount / 100).toLocaleString('en-US', {
                        style: 'currency',
                        currency: price.currency,
                        minimumFractionDigits: 0,
                      })}
                    </span>

                    <span className="text-xs">per {"month"}</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-2">
                  <p className="font-medium">
                    <Trans>Features</Trans>
                  </p>

                  <ul className="flex flex-col gap-2">
                    {price.product.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </span>

                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>

              <CardFooter
                className={cn('flex-col gap-2 border-t p-6', {
                  'pb-10': true,
                })}
              >
                <Button
                  type="button"
                  className="w-full"
                  disabled={false}
                  onClick={() => void handleCheckoutClick(price.id)}
                >
                  <Trans>Upgrade now</Trans>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="year">
          {prices.yearly.map((price) => (
            <Card key={price.id} className="relative mt-4 flex flex-col overflow-hidden">
              <CardContent className="grid flex-1 gap-4 p-6">
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-bold">{price.product.name}</h3>
                  <p className="text-sm text-muted-foreground">{price.product.description}</p>
                </div>

                <div className="mt-4 flex flex-col gap-1">
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold">
                      {(price.unit_amount / 100).toLocaleString('en-US', {
                        style: 'currency',
                        currency: price.currency,
                        minimumFractionDigits: 0,
                      })}
                    </span>

                    <span className="text-xs">per {"year"}</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-2">
                  <p className="font-medium">
                    <Trans>Features</Trans>
                  </p>

                  <ul className="flex flex-col gap-2">
                    {price.product.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </span>

                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>

              <CardFooter
                className={cn('flex-col gap-2 border-t p-6', {
                  'pb-10': true,
                })}
              >
                <Button
                  type="button"
                  className="w-full"
                  disabled={false}
                  onClick={() => void handleCheckoutClick(price.id)}
                >
                  <Trans>Upgrade now</Trans>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};
