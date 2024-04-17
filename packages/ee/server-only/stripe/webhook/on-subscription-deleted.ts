<<<<<<< HEAD
import { Stripe } from '@documenso/lib/server-only/stripe';
=======
import type { Stripe } from '@documenso/lib/server-only/stripe';
>>>>>>> main
import { prisma } from '@documenso/prisma';
import { SubscriptionStatus } from '@documenso/prisma/client';

export type OnSubscriptionDeletedOptions = {
  subscription: Stripe.Subscription;
};

export const onSubscriptionDeleted = async ({ subscription }: OnSubscriptionDeletedOptions) => {
<<<<<<< HEAD
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

  await prisma.subscription.update({
    where: {
      customerId,
=======
  await prisma.subscription.update({
    where: {
      planId: subscription.id,
>>>>>>> main
    },
    data: {
      status: SubscriptionStatus.INACTIVE,
    },
  });
};
