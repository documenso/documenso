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
 * Asserts that a proposed member count does not exceed the organisation's cap.
 *
 * Only enforced for non-seats-based plans, since seats-based plans meter usage
 * via Stripe rather than enforcing a hard cap. A `memberCount` of `0` on the
 * organisation claim represents unlimited seats.
 *
 * Should only be called from grow paths (invite/add). Reducing operations
 * must never be gated by this check.
 *
 * @param subscription - The organisation's Stripe subscription.
 * @param organisationClaim - The organisation claim.
 * @param quantity - The proposed total member + pending invite count.
 */
export const assertMemberCountWithinCap = async (
  subscription: Subscription,
  organisationClaim: OrganisationClaim,
  quantity: number,
) => {
  const maximumMemberCount = organisationClaim.memberCount;

  // 0 = unlimited.
  if (maximumMemberCount === 0) {
    return;
  }

  // Seats-based plans don't have a hard cap; Stripe meters the usage.
  const isSeatsBased = await isPriceSeatsBased(subscription.priceId);

  if (isSeatsBased) {
    return;
  }

  if (quantity > maximumMemberCount) {
    throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
      message: 'Maximum member count reached',
    });
  }
};

/**
 * Syncs the organisation's member count with the Stripe subscription quantity.
 *
 * No-ops for plans that are not seats-based, and for organisations with
 * unlimited seats (`organisationClaim.memberCount === 0`). Safe to call from
 * both grow and shrink paths.
 *
 * @param subscription - The subscription to sync the member count with.
 * @param organisationClaim - The organisation claim.
 * @param quantity - The new total member + pending invite count to sync.
 */
export const syncMemberCountWithStripeSeatPlan = async (
  subscription: Subscription,
  organisationClaim: OrganisationClaim,
  quantity: number,
) => {
  // Infinite seats means no sync needed.
  if (organisationClaim.memberCount === 0) {
    return;
  }

  const isSeatsBased = await isPriceSeatsBased(subscription.priceId);

  if (!isSeatsBased) {
    return;
  }

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
};
