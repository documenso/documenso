import { SubscriptionStatus } from '@prisma/client';

import type { Stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';

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
