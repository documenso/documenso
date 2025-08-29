import type { OrganisationClaim, Subscription } from '@prisma/client';
import type Stripe from 'stripe';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { stripe } from '@documenso/lib/server-only/stripe';
import { appLog } from '@documenso/lib/utils/debugger';
import { prisma } from '@documenso/prisma';

import { isPriceSeatsBased } from './is-price-seats-based';

export type UpdateSubscriptionItemQuantityOptions = {
  subscriptionId: string;
  quantity: number;
  priceId: string;
};

export const updateSubscriptionItemQuantity = async ({
  subscriptionId,
  quantity,
  priceId,
}: UpdateSubscriptionItemQuantityOptions) => {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const items = subscription.items.data.filter((item) => item.price.id === priceId);

  if (items.length !== 1) {
    throw new Error('Subscription does not contain required item');
  }

  const hasYearlyItem = items.find((item) => item.price.recurring?.interval === 'year');
  const oldQuantity = items[0].quantity;

  if (oldQuantity === quantity) {
    return;
  }

  const subscriptionUpdatePayload: Stripe.SubscriptionUpdateParams = {
    items: items.map((item) => ({
      id: item.id,
      quantity,
    })),
  };

  // Only invoice immediately when changing the quantity of yearly item.
  if (hasYearlyItem) {
    subscriptionUpdatePayload.proration_behavior = 'always_invoice';
  }

  await stripe.subscriptions.update(subscriptionId, subscriptionUpdatePayload);
};

/**
 * Checks whether the member count should be synced with a given Stripe subscription.
 *
 * If the subscription is not "seat" based, it will be ignored.
 *
 * @param subscription - The subscription to sync the member count with.
 * @param organisationClaim - The organisation claim
 * @param quantity - The amount to sync the Stripe item with
 * @returns
 */
export const syncMemberCountWithStripeSeatPlan = async (
  subscription: Subscription,
  organisationClaim: OrganisationClaim,
  quantity: number,
) => {
  const maximumMemberCount = organisationClaim.memberCount;

  // Infinite seats means no sync needed.
  if (maximumMemberCount === 0) {
    return;
  }

  const syncMemberCountWithStripe = await isPriceSeatsBased(subscription.priceId);

  // Throw error if quantity exceeds maximum member count and the subscription is not seats based.
  if (quantity > maximumMemberCount && !syncMemberCountWithStripe) {
    throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
      message: 'Maximum member count reached',
    });
  }

  // Bill the user with the new quantity.
  if (syncMemberCountWithStripe) {
    appLog('BILLING', 'Updating seat based plan');

    await updateSubscriptionItemQuantity({
      priceId: subscription.priceId,
      subscriptionId: subscription.planId,
      quantity,
    });

    // This should be automatically updated after the Stripe webhook is fired
    // but we just manually adjust it here as well to avoid any race conditions.
    await prisma.organisationClaim.update({
      where: {
        id: organisationClaim.id,
      },
      data: {
        memberCount: quantity,
      },
    });
  }
};
