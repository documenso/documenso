import { match } from 'ts-pattern';

import type { Stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';
import type { Prisma } from '@documenso/prisma/client';
import { SubscriptionStatus } from '@documenso/prisma/client';

export type OnSubscriptionUpdatedOptions = {
  userId?: number;
  teamId?: number;
  subscription: Stripe.Subscription;
};

export const onSubscriptionUpdated = async ({
  userId,
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

  const status = match(subscription.status)
    .with('active', () => SubscriptionStatus.ACTIVE)
    .with('past_due', () => SubscriptionStatus.PAST_DUE)
    .otherwise(() => SubscriptionStatus.INACTIVE);

  return {
    where: {
      planId: subscription.id,
    },
    create: {
      status: status,
      planId: subscription.id,
      priceId: subscription.items.data[0].price.id,
      periodEnd: new Date(subscription.current_period_end * 1000),
      userId: userId ?? null,
      teamId: teamId ?? null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
      status: status,
      planId: subscription.id,
      priceId: subscription.items.data[0].price.id,
      periodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  };
};
