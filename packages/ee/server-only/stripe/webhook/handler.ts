import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import type { Stripe } from '@documenso/lib/server-only/stripe';
import { stripe } from '@documenso/lib/server-only/stripe';
import { env } from '@documenso/lib/utils/env';

import { syncStripeCustomerSubscription } from '../sync-stripe-customer-subscription';

type StripeWebhookResponse = {
  success: boolean;
  message: string;
};

/**
 * Events that trigger a sync of the customer's subscription state.
 *
 * The event payload is never trusted beyond extracting the customer ID,
 * the sync function fetches the current truth from Stripe.
 */
const SYNCED_EVENT_TYPES: string[] = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'checkout.session.completed',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
];

export const stripeWebhookHandler = async (req: Request): Promise<Response> => {
  try {
    const isBillingEnabled = IS_BILLING_ENABLED();

    const webhookSecret = env('NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      throw new Error('Missing Stripe webhook secret');
    }

    if (!isBillingEnabled) {
      return Response.json(
        {
          success: false,
          message: 'Billing is disabled',
        } satisfies StripeWebhookResponse,
        { status: 500 },
      );
    }

    const signature =
      typeof req.headers.get('stripe-signature') === 'string' ? req.headers.get('stripe-signature') : '';

    if (!signature) {
      return Response.json(
        {
          success: false,
          message: 'No signature found in request',
        } satisfies StripeWebhookResponse,
        { status: 400 },
      );
    }

    const payload = await req.text();

    if (!payload) {
      return Response.json(
        {
          success: false,
          message: 'No payload found in request',
        } satisfies StripeWebhookResponse,
        { status: 400 },
      );
    }

    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    if (!SYNCED_EVENT_TYPES.includes(event.type)) {
      return Response.json(
        {
          success: true,
          message: 'Webhook received',
        } satisfies StripeWebhookResponse,
        { status: 200 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const eventObject = event.data.object as { customer?: string | Stripe.Customer | null };

    const customerId = typeof eventObject.customer === 'string' ? eventObject.customer : eventObject.customer?.id;

    if (!customerId) {
      console.error(`No customer found on ${event.type} event ${event.id}, nothing to sync`);

      return Response.json(
        {
          success: true,
          message: 'Webhook received',
        } satisfies StripeWebhookResponse,
        { status: 200 },
      );
    }

    await syncStripeCustomerSubscription({ customerId });

    return Response.json(
      {
        success: true,
        message: 'Webhook received',
      } satisfies StripeWebhookResponse,
      { status: 200 },
    );
  } catch (err) {
    console.error(err);

    return Response.json(
      {
        success: false,
        message: 'Unknown error',
      } satisfies StripeWebhookResponse,
      { status: 500 },
    );
  }
};
