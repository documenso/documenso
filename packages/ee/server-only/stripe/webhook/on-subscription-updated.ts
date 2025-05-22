import type { Prisma, SubscriptionClaim } from '@prisma/client';
import { SubscriptionStatus } from '@prisma/client';
import { match } from 'ts-pattern';

import { type Stripe, stripe } from '@documenso/lib/server-only/stripe';
import { prisma } from '@documenso/prisma';

export type OnSubscriptionUpdatedOptions = {
  subscription: Stripe.Subscription;
  previousAttributes: Partial<Stripe.Subscription> | null;
};

type StripeWebhookResponse = {
  success: boolean;
  message: string;
};

export const onSubscriptionUpdated = async ({
  subscription,
  previousAttributes,
}: OnSubscriptionUpdatedOptions) => {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

  // Todo: logging
  if (subscription.items.data.length !== 1) {
    console.error('No support for multiple items');

    throw Response.json(
      {
        success: false,
        message: 'No support for multiple items',
      } satisfies StripeWebhookResponse,
      { status: 500 },
    );
  }

  const organisation = await prisma.organisation.findFirst({
    where: {
      customerId,
    },
    include: {
      organisationClaim: true,
      subscription: true,
    },
  });

  if (!organisation) {
    throw Response.json(
      {
        success: false,
        message: `Organisation not found`,
      } satisfies StripeWebhookResponse,
      { status: 500 },
    );
  }

  if (organisation.subscription?.planId !== subscription.id) {
    console.error('[WARNING]: Organisation has two subscriptions');
  }

  const previousItem = previousAttributes?.items?.data[0];
  const updatedItem = subscription.items.data[0];

  const previousSubscriptionClaimId = previousItem
    ? await extractStripeClaimId(previousItem.price)
    : null;
  const updatedSubscriptionClaim = await extractStripeClaim(updatedItem.price);

  if (!updatedSubscriptionClaim) {
    console.error(`Subscription claim on ${updatedItem.price.id} not found`);

    throw Response.json(
      {
        success: false,
        message: `Subscription claim on ${updatedItem.price.id} not found`,
      } satisfies StripeWebhookResponse,
      { status: 500 },
    );
  }

  const newClaimFound = previousSubscriptionClaimId !== updatedSubscriptionClaim.id;

  const status = match(subscription.status)
    .with('active', () => SubscriptionStatus.ACTIVE)
    .with('past_due', () => SubscriptionStatus.PAST_DUE)
    .otherwise(() => SubscriptionStatus.INACTIVE);

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: {
        planId: subscription.id,
      },
      data: {
        organisationId: organisation.id,
        status: status,
        planId: subscription.id,
        priceId: subscription.items.data[0].price.id,
        periodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });

    // Override current organisation claim if new one is found.
    if (newClaimFound) {
      await tx.organisationClaim.update({
        where: {
          id: organisation.organisationClaim.id,
        },
        data: {
          originalSubscriptionClaimId: updatedSubscriptionClaim.id,
          ...createOrganisationClaimUpsertData(updatedSubscriptionClaim),
        },
      });
    }
  });
};

export const createOrganisationClaimUpsertData = (subscriptionClaim: SubscriptionClaim) => {
  // Done like this to ensure type errors are thrown if items are added.
  const data: Omit<
    Prisma.SubscriptionClaimCreateInput,
    'id' | 'createdAt' | 'updatedAt' | 'locked' | 'name'
  > = {
    flags: {
      ...subscriptionClaim.flags,
    },
    teamCount: subscriptionClaim.teamCount,
    memberCount: subscriptionClaim.memberCount,
  };

  return {
    ...data,
  };
};

/**
 * Checks the price metadata for a claimId, if it is missing it will fetch
 * and check the product metadata for a claimId.
 *
 * The order of priority is:
 * 1. Price metadata
 * 2. Product metadata
 *
 * @returns The claimId or null if no claimId is found.
 */
export const extractStripeClaimId = async (priceId: Stripe.Price) => {
  if (priceId.metadata.claimId) {
    return priceId.metadata.claimId;
  }

  const productId = typeof priceId.product === 'string' ? priceId.product : priceId.product.id;

  const product = await stripe.products.retrieve(productId);

  return product.metadata.claimId || null;
};

/**
 * Checks the price metadata for a claimId, if it is missing it will fetch
 * and check the product metadata for a claimId.
 *
 */
export const extractStripeClaim = async (priceId: Stripe.Price) => {
  const claimId = await extractStripeClaimId(priceId);

  if (!claimId) {
    return null;
  }

  const subscriptionClaim = await prisma.subscriptionClaim.findFirst({
    where: { id: claimId },
  });

  if (!subscriptionClaim) {
    console.error(`Subscription claim ${claimId} not found`);
    return null;
  }

  return subscriptionClaim;
};
