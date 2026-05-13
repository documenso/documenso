import { Stripe, stripe } from '../../../server-only/stripe';
import type { JobRunIO } from '../../client/_internal/job';
import type { TCancelOrganisationSubscriptionJobDefinition } from './cancel-organisation-subscription';

/**
 * Marks the given Stripe subscription for cancellation at the end of the
 * current billing period.
 *
 * Idempotent: calling this on an already-cancel-at-period-end subscription is
 * a no-op for Stripe and returns the same shape, so re-running the job after
 * a partial failure is safe.
 *
 * If the subscription no longer exists in Stripe (`resource_missing`), the
 * job treats it as a no-op rather than retrying forever \u2014 nothing further
 * can be done.
 */
export const run = async ({ payload }: { payload: TCancelOrganisationSubscriptionJobDefinition; io: JobRunIO }) => {
  const { stripeSubscriptionId } = payload;

  try {
    await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  } catch (error) {
    // Subscription no longer exists in Stripe \u2014 nothing to cancel. Treat as
    // success so the job doesn't retry indefinitely.
    if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === 'resource_missing') {
      console.warn(
        `[CANCEL_ORGANISATION_SUBSCRIPTION] Stripe subscription ${stripeSubscriptionId} no longer exists; skipping.`,
      );

      return;
    }

    // Anything else: rethrow so the job runner retries.
    throw error;
  }
};
