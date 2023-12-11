import { match } from 'ts-pattern';

import type { Stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';
import { SubscriptionStatus } from '@documenso/prisma/client';

export type OnSubscriptionUpdatedOptions = {
  userId: number;
  subscription: Stripe.Subscription;
};

export const onSubscriptionUpdated = async ({
  userId,
  subscription,
}: OnSubscriptionUpdatedOptions) => {
  const status = match(subscription.status)
    .with('active', () => SubscriptionStatus.ACTIVE)
    .with('past_due', () => SubscriptionStatus.PAST_DUE)
    .otherwise(() => SubscriptionStatus.INACTIVE);

  await prisma.subscription.upsert({
    where: {
      planId: subscription.id,
    },
    create: {
      status: status,
      planId: subscription.id,
      priceId: subscription.items.data[0].price.id,
      periodEnd: new Date(subscription.current_period_end * 1000),
      userId,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
      status: status,
      planId: subscription.id,
      priceId: subscription.items.data[0].price.id,
      periodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
};
