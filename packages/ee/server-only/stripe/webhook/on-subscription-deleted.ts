import { Stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';
import { SubscriptionStatus } from '@documenso/prisma/client';

export type OnSubscriptionDeletedOptions = {
  subscription: Stripe.Subscription;
};

export const onSubscriptionDeleted = async ({ subscription }: OnSubscriptionDeletedOptions) => {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

  await prisma.subscription.update({
    where: {
      customerId,
    },
    data: {
      status: SubscriptionStatus.INACTIVE,
    },
  });
};
