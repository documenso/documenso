import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { stripe } from '@documenso/lib/server-only/stripe';
import { appLog } from '@documenso/lib/utils/debugger';
import { prisma } from '@documenso/prisma';
import type { OrganisationClaim, Subscription } from '@prisma/client';
import { SubscriptionStatus } from '@prisma/client';
import type Stripe from 'stripe';

import { isPriceSeatsBased } from './is-price-seats-based';

export type UpdateSubscriptionItemQuantityOptions = {
  subscriptionId: string;
  quantity: number;
  priceId: string;
  prorationBehaviour: 'always_invoice' | 'none';
};

export const updateSubscriptionItemQuantity = async ({
  subscriptionId,
  quantity,
  priceId,
  prorationBehaviour,
}: UpdateSubscriptionItemQuantityOptions) => {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const items = subscription.items.data.filter((item) => item.price.id === priceId);

  if (items.length !== 1) {
    throw new Error('Subscription does not contain required item');
  }

  const oldQuantity = items[0].quantity;

  if (oldQuantity === quantity) {
    return;
  }

  const subscriptionUpdatePayload: Stripe.SubscriptionUpdateParams = {
    items: items.map((item) => ({
      id: item.id,
      quantity,
    })),
    proration_behavior: prorationBehaviour,
    // Need to "off_session" updates since adding 3DS will have payments
    // not pass through for these immediate invoices.
    off_session: true,
  };

  await stripe.subscriptions.update(subscriptionId, subscriptionUpdatePayload);
};

/**
 * Asserts that a proposed member count does not exceed the organisation's cap.
 *
 * Only enforced for non-seats-based plans, since seats-based plans meter usage
 * via Stripe rather than enforcing a hard cap. A `memberCount` of `0` on the
 * organisation claim represents unlimited seats.
 *
 * Organisations without a subscription (e.g. after being downgraded to the
 * free plan) can pass `null`, in which case the claim cap is enforced
 * directly without the seats-based exemption.
 *
 * Should only be called from grow paths (invite/add). Reducing operations
 * must never be gated by this check.
 *
 * @param subscription - The organisation's Stripe subscription, if any.
 * @param organisationClaim - The organisation claim.
 * @param quantity - The proposed total member count.
 */
export const assertMemberCountWithinCap = async (
  subscription: Subscription | null,
  organisationClaim: OrganisationClaim,
  quantity: number,
) => {
  const maximumMemberCount = organisationClaim.memberCount;

  // 0 = unlimited.
  if (maximumMemberCount === 0) {
    return;
  }

  // Seats-based plans don't have a hard cap; Stripe meters the usage.
  if (subscription) {
    const isSeatsBased = await isPriceSeatsBased(subscription.priceId);

    if (isSeatsBased) {
      return;
    }
  }

  if (quantity > maximumMemberCount) {
    throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
      message: 'Maximum member count reached',
    });
  }
};

/**
 * Syncs the Stripe subscription quantity with the organisation's member count.
 *
 * This is a Stripe <-> Database sync operation.
 *
 * Note: `organisationClaim.memberCount` is the paid seat high-water mark for the
 * current billing period — the highest count we've already billed for.
 *
 * @param subscription - The subscription to sync the member count with.
 * @param organisationClaim - The organisation claim.
 * @param quantity - The new total member count to sync.
 * @param mode - The member-count change that triggered the sync.
 */
export const syncMemberCountWithStripeSeatPlan = async (
  subscription: Subscription,
  organisationClaim: OrganisationClaim,
  quantity: number,
  mode: 'grow' | 'shrink',
) => {
  // Unlimited seats — nothing to meter.
  if (organisationClaim.memberCount === 0) {
    return;
  }

  const isSeatsBased = await isPriceSeatsBased(subscription.priceId);

  // Only seat-based plans support seat syncing.
  if (!isSeatsBased) {
    return;
  }

  // Whether to immediately invoice for new seats if the quantity is greater than
  // the high-water mark.
  const billsForNewSeats = mode === 'grow' && quantity > organisationClaim.memberCount;

  appLog('BILLING', `Syncing seat based plan (${mode}, quantity ${quantity})`);

  await updateSubscriptionItemQuantity({
    priceId: subscription.priceId,
    subscriptionId: subscription.planId,
    quantity,
    prorationBehaviour: billsForNewSeats ? 'always_invoice' : 'none',
  });

  // Advance the high-water mark when billing for new seats; it is reset to the
  // actual member count when the billing period rolls over. Re-adds and shrinks
  // deliberately leave it untouched so a seat already paid for this period is
  // never re-charged.
  if (billsForNewSeats) {
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

/**
 * Reconciles the organisation claim seat counter, and the stripe quantity with the
 * actual member count.
 *
 * Uses the member count as the authoritative source of truth. Meaning:
 * - Update the organisation claim with the member count
 * - Update the Stripe subscription quantity to the member count
 *
 * This should only be called when the billing period rolls over.
 */
export const reconcileSeatBasedPlans = async (organisationId: string) => {
  const organisation = await prisma.organisation.findFirst({
    where: {
      id: organisationId,
    },
    include: {
      organisationClaim: true,
      subscription: true,
    },
  });

  if (!organisation || !organisation.subscription) {
    return;
  }

  const { subscription, organisationClaim } = organisation;

  // Stripe rejects quantity updates on canceled subscriptions. PAST_DUE is
  // still live and a no-proration sync is safe, so it's allowed through.
  if (subscription.status === SubscriptionStatus.INACTIVE) {
    return;
  }

  // Unlimited seats — nothing to meter.
  if (organisationClaim.memberCount === 0) {
    return;
  }

  const isSeatsBased = await isPriceSeatsBased(subscription.priceId);

  // Only seat-based plans support seat syncing.
  if (!isSeatsBased) {
    return;
  }

  const memberCount = await prisma.organisationMember.count({
    where: {
      organisationId,
    },
  });

  // An organisation always retains its owner; never write the unlimited sentinel.
  if (memberCount === 0) {
    return;
  }

  await updateSubscriptionItemQuantity({
    priceId: subscription.priceId,
    subscriptionId: subscription.planId,
    quantity: memberCount,
    prorationBehaviour: 'none',
  });

  await prisma.organisationClaim.update({
    where: {
      id: organisationClaim.id,
    },
    data: {
      memberCount,
    },
  });
};
