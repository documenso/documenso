import type { Subscription } from '@documenso/prisma/generated/zod/modelSchema/SubscriptionSchema';

import { IS_BILLING_ENABLED } from '../constants/app';
import { AppError, AppErrorCode } from '../errors/app-error';
import type { StripeOrganisationCreateMetadata } from '../types/subscription';

export const generateStripeOrganisationCreateMetadata = (organisationName: string, userId: number) => {
  const metadata: StripeOrganisationCreateMetadata = {
    organisationName,
    userId,
  };

  return {
    organisationCreateData: JSON.stringify(metadata),
  };
};

/**
 * Throws an error if billing is enabled and no subscription is found.
 */
export const validateIfSubscriptionIsRequired = (subscription?: Subscription | null) => {
  const isBillingEnabled = IS_BILLING_ENABLED();

  if (!isBillingEnabled) {
    return;
  }

  if (isBillingEnabled && !subscription) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Subscription not found',
    });
  }

  return subscription;
};

export type SeatSyncMode = 'grow' | 'reconcile';

export type SeatProrationBehaviour = 'always_invoice' | 'none';

export type GetSeatSyncPlanOptions = {
  mode: SeatSyncMode;

  /**
   * The seat count already paid for in the current billing period (the paid
   * seat high-water mark). For seat-based plans this is
   * `organisationClaim.memberCount`, which mirrors the Stripe subscription
   * item quantity.
   *
   * A value of `0` means unlimited seats: the helper returns
   * `{ shouldSync: false }` as defence in depth, but callers should still
   * no-op before calling (see `syncMemberCountWithStripeSeatPlan`). Above
   * `0`, only consulted in `grow` mode.
   */
  paidSeatCount: number;

  /**
   * The proposed total member count.
   */
  newSeatCount: number;
};

export type SeatSyncPlan = { shouldSync: false } | { shouldSync: true; prorationBehaviour: SeatProrationBehaviour };

/**
 * Decides whether and how a seat count change should be synced with Stripe.
 *
 * - Grow (member added): seats within the paid high-water mark are free, the
 *   organisation already paid for them this billing period. Seats above the
 *   mark are invoiced immediately (`always_invoice`) on monthly and yearly
 *   plans alike.
 * - Reconcile (billing period advanced): always syncs to the actual member
 *   count with `none` in both directions. No credits are issued when
 *   shrinking and no retroactive charges are created when healing upward
 *   drift (e.g. unbilled SSO portal joins). Equal counts still sync so a
 *   drifted Stripe quantity is corrected; the Stripe update helper no-ops
 *   when the quantity already matches.
 */
export const getSeatSyncPlan = ({ mode, paidSeatCount, newSeatCount }: GetSeatSyncPlanOptions): SeatSyncPlan => {
  // 0 is the unlimited-seats sentinel: unlimited organisations never seat
  // sync, in either mode. Callers should still no-op earlier (see
  // syncMemberCountWithStripeSeatPlan) — this is defence in depth.
  if (paidSeatCount === 0) {
    return { shouldSync: false };
  }

  if (mode === 'grow' && newSeatCount <= paidSeatCount) {
    return { shouldSync: false };
  }

  return {
    shouldSync: true,
    prorationBehaviour: mode === 'grow' ? 'always_invoice' : 'none',
  };
};
