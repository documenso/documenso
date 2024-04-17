import { match } from 'ts-pattern';

<<<<<<< HEAD
import { Stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';
import { SubscriptionStatus } from '@documenso/prisma/client';

export type OnSubscriptionUpdatedOptions = {
  userId: number;
=======
import type { Stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';
import type { Prisma } from '@documenso/prisma/client';
import { SubscriptionStatus } from '@documenso/prisma/client';

export type OnSubscriptionUpdatedOptions = {
  userId?: number;
  teamId?: number;
>>>>>>> main
  subscription: Stripe.Subscription;
};

export const onSubscriptionUpdated = async ({
  userId,
<<<<<<< HEAD
  subscription,
}: OnSubscriptionUpdatedOptions) => {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
=======
  teamId,
  subscription,
}: OnSubscriptionUpdatedOptions) => {
  await prisma.subscription.upsert(
    mapStripeSubscriptionToPrismaUpsertAction(subscription, userId, teamId),
  );
};

export const mapStripeSubscriptionToPrismaUpsertAction = (
  subscription: Stripe.Subscription,
  userId?: number,
  teamId?: number,
): Prisma.SubscriptionUpsertArgs => {
  if ((!userId && !teamId) || (userId && teamId)) {
    throw new Error('Either userId or teamId must be provided.');
  }
>>>>>>> main

  const status = match(subscription.status)
    .with('active', () => SubscriptionStatus.ACTIVE)
    .with('past_due', () => SubscriptionStatus.PAST_DUE)
    .otherwise(() => SubscriptionStatus.INACTIVE);

<<<<<<< HEAD
  await prisma.subscription.upsert({
    where: {
      customerId,
    },
    create: {
      customerId,
=======
  return {
    where: {
      planId: subscription.id,
    },
    create: {
>>>>>>> main
      status: status,
      planId: subscription.id,
      priceId: subscription.items.data[0].price.id,
      periodEnd: new Date(subscription.current_period_end * 1000),
<<<<<<< HEAD
      userId,
    },
    update: {
      customerId,
=======
      userId: userId ?? null,
      teamId: teamId ?? null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
>>>>>>> main
      status: status,
      planId: subscription.id,
      priceId: subscription.items.data[0].price.id,
      periodEnd: new Date(subscription.current_period_end * 1000),
<<<<<<< HEAD
    },
  });
=======
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  };
>>>>>>> main
};
