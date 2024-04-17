import { match } from 'ts-pattern';

import { Stripe } from '@documenso/lib/server-only/stripe';
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
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

  const status = match(subscription.status)
    .with('active', () => SubscriptionStatus.ACTIVE)
    .with('past_due', () => SubscriptionStatus.PAST_DUE)
    .otherwise(() => SubscriptionStatus.INACTIVE);

  await prisma.subscription.upsert({
    where: {
      customerId,
    },
    create: {
      customerId,
      status: status,
      planId: subscription.id,
      priceId: subscription.items.data[0].price.id,
      periodEnd: new Date(subscription.current_period_end * 1000),
      userId,
    },
    update: {
      customerId,
      status: status,
      planId: subscription.id,
      priceId: subscription.items.data[0].price.id,
      periodEnd: new Date(subscription.current_period_end * 1000),
    },
  });
};
