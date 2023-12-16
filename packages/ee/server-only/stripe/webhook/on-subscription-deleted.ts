import type { Stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';
import { SubscriptionStatus } from '@documenso/prisma/client';

export type OnSubscriptionDeletedOptions = {
  subscription: Stripe.Subscription;
};

export const onSubscriptionDeleted = async ({ subscription }: OnSubscriptionDeletedOptions) => {
  await prisma.subscription.update({
    where: {
      planId: subscription.id,
    },
    data: {
      status: SubscriptionStatus.INACTIVE,
    },
  });
};
