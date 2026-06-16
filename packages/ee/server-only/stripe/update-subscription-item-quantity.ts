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
 * Syncs the organisation's member count with the Stripe subscription quantity.
 *
 * For seat-based plans, `organisationClaim.memberCount` is the paid seat
 * high-water mark for the current billing period and always mirrors the
 * Stripe quantity.
 *
 * - Mode `grow`: will skip if the new count is within the paid
 *   high-water mark (the seat is already paid for); anything above the mark
 *   is invoiced immediately.
 * - Mode `reconcile`: writes the actual member count with no prorations in
 *   either direction (renewal-time true-up).
 *
 * No-ops for plans that are not seats-based and for organisations with
 * unlimited seats (`organisationClaim.memberCount === 0`).
 *
 * @param subscription - The subscription to sync the member count with.
 * @param organisationClaim - The organisation claim.
 * @param quantity - The new total member count to sync.
 * @param mode - Whether this is a grow operation or a renewal reconcile.
 */
export const syncMemberCountWithStripeSeatPlan = async (
  subscription: Subscription,
  organisationClaim: OrganisationClaim,
  quantity: number,
  mode: 'grow' | 'reconcile',
) => {
  // Early return if the organisation has unlimited seats.
  if (organisationClaim.memberCount === 0) {
    return;
  }

  // Early return if the new count is less than the paid high-water mark for grow mode.
  if (mode === 'grow' && quantity <= organisationClaim.memberCount) {
    return;
  }

  const isSeatsBased = await isPriceSeatsBased(subscription.priceId);

  // Only seat-based plans support seat syncing.
  if (!isSeatsBased) {
    return;
  }

  appLog('BILLING', `Updating seat based plan (${mode})`);

  await updateSubscriptionItemQuantity({
    priceId: subscription.priceId,
    subscriptionId: subscription.planId,
    quantity,
    prorationBehaviour: mode === 'grow' ? 'always_invoice' : 'none',
  });

  // The claim mirrors the Stripe quantity (the paid seat high-water mark).
  // This write is the only place the mark advances on grow — the
  // subscription webhook's claim overwrite preserves the already-billed
  // Stripe quantity but never advances it.
  await prisma.organisationClaim.update({
    where: {
      id: organisationClaim.id,
    },
    data: {
      memberCount: quantity,
    },
  });
};

/**
 * Reconciles the Stripe seat quantity and organisation claim with the actual
 * member count at the start of a new billing period.
 *
 * Called from the `customer.subscription.updated` webhook when the billing
 * period advances. The renewal invoice has already been generated at the
 * previous (high-water) quantity by then — the reconciled count takes effect
 * on the next invoice (accepted trade-off: removed seats bill for exactly
 * one extra period).
 *
 * Runs with no prorations in either direction: no credits when shrinking,
 * no retroactive charges when healing upward drift (e.g. unbilled SSO
 * portal joins or lost grow races).
 */
export const reconcileSeatsWithMemberCount = async (organisationId: string) => {
  const organisation = await prisma.organisation.findUnique({
    where: {
      id: organisationId,
    },
    include: {
      subscription: true,
      organisationClaim: true,
    },
  });

  if (!organisation || !organisation.subscription) {
    appLog('BILLING', 'Reconcile skipped: organisation or subscription not found');

    return;
  }

  // Only ACTIVE subscriptions reconcile. INACTIVE (canceled) subscriptions
  // cannot have their quantity updated in Stripe, and skipping PAST_DUE is
  // deliberate: drift heals at the first renewal after recovery.
  if (organisation.subscription.status !== SubscriptionStatus.ACTIVE) {
    appLog('BILLING', 'Reconcile skipped: subscription not active');

    return;
  }

  const memberCount = await prisma.organisationMember.count({
    where: {
      organisationId,
    },
  });

  // An organisation always has at least its owner. Guarding zero protects
  // more than the Stripe quantity: writing 0 to the claim would flip
  // memberCount to the unlimited sentinel and permanently exempt the
  // organisation from seat billing.
  if (memberCount === 0) {
    appLog('BILLING', 'Reconcile skipped: organisation has no members');

    return;
  }

  await syncMemberCountWithStripeSeatPlan(
    organisation.subscription,
    organisation.organisationClaim,
    memberCount,
    'reconcile',
  );
};
