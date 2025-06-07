import { match } from 'ts-pattern';

import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import type { Stripe } from '@documenso/lib/server-only/stripe';
import { stripe } from '@documenso/lib/server-only/stripe';
import { env } from '@documenso/lib/utils/env';

import { onSubscriptionCreated } from './on-subscription-created';
import { onSubscriptionDeleted } from './on-subscription-deleted';
import { onSubscriptionUpdated } from './on-subscription-updated';

type StripeWebhookResponse = {
  success: boolean;
  message: string;
};

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
      typeof req.headers.get('stripe-signature') === 'string'
        ? req.headers.get('stripe-signature')
        : '';

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

    /**
     * Notes:
     * - Dropped invoice.payment_succeeded
     * - Dropped invoice.payment_failed
     * - Dropped checkout-session.completed
     */
    return await match(event.type)
      .with('customer.subscription.created', async () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const subscription = event.data.object as Stripe.Subscription;

        await onSubscriptionCreated({ subscription });

        return Response.json(
          { success: true, message: 'Webhook received' } satisfies StripeWebhookResponse,
          { status: 200 },
        );
      })
      .with('customer.subscription.updated', async () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const subscription = event.data.object as Stripe.Subscription;

        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const previousAttributes = event.data
          .previous_attributes as Partial<Stripe.Subscription> | null;

        await onSubscriptionUpdated({ subscription, previousAttributes });

        return Response.json(
          { success: true, message: 'Webhook received' } satisfies StripeWebhookResponse,
          { status: 200 },
        );
      })
      .with('customer.subscription.deleted', async () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const subscription = event.data.object as Stripe.Subscription;

        await onSubscriptionDeleted({ subscription });

        return Response.json(
          {
            success: true,
            message: 'Webhook received',
          } satisfies StripeWebhookResponse,
          { status: 200 },
        );
      })
      .otherwise(() => {
        return Response.json(
          {
            success: true,
            message: 'Webhook received',
          } satisfies StripeWebhookResponse,
          { status: 200 },
        );
      });
  } catch (err) {
    console.error(err);

    if (err instanceof Response) {
      const message = await err.json();
      console.error(message);

      return err;
    }

    return Response.json(
      {
        success: false,
        message: 'Unknown error',
      } satisfies StripeWebhookResponse,
      { status: 500 },
    );
  }
};
