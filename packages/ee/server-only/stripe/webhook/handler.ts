import { match } from 'ts-pattern';

import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { STRIPE_PLAN_TYPE } from '@documenso/lib/constants/billing';
import type { Stripe } from '@documenso/lib/server-only/stripe';
import { stripe } from '@documenso/lib/server-only/stripe';
import { createTeamFromPendingTeam } from '@documenso/lib/server-only/team/create-team';
import { env } from '@documenso/lib/utils/env';
import { prisma } from '@documenso/prisma';

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

    return await match(event.type)
      .with('checkout.session.completed', async () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const session = event.data.object as Stripe.Checkout.Session;

        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id;

        // Attempt to get the user ID from the client reference id.
        let userId = Number(session.client_reference_id);

        // If the user ID is not found, attempt to get it from the Stripe customer metadata.
        if (!userId && customerId) {
          const customer = await stripe.customers.retrieve(customerId);

          if (!customer.deleted) {
            userId = Number(customer.metadata.userId);
          }
        }

        // Finally, attempt to get the user ID from the subscription within the database.
        if (!userId && customerId) {
          const result = await prisma.user.findFirst({
            select: {
              id: true,
            },
            where: {
              customerId,
            },
          });

          if (result?.id) {
            userId = result.id;
          }
        }

        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;

        if (!subscriptionId) {
          return Response.json(
            { success: false, message: 'Invalid session' } satisfies StripeWebhookResponse,
            { status: 500 },
          );
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Handle team creation after seat checkout.
        if (subscription.items.data[0].price.metadata.plan === STRIPE_PLAN_TYPE.TEAM) {
          await handleTeamSeatCheckout({ subscription });

          return Response.json(
            { success: true, message: 'Webhook received' } satisfies StripeWebhookResponse,
            { status: 200 },
          );
        }

        // Validate user ID.
        if (!userId || Number.isNaN(userId)) {
          return Response.json(
            {
              success: false,
              message: 'Invalid session or missing user ID',
            } satisfies StripeWebhookResponse,
            { status: 500 },
          );
        }

        await onSubscriptionUpdated({ userId, subscription });

        return Response.json(
          { success: true, message: 'Webhook received' } satisfies StripeWebhookResponse,
          { status: 200 },
        );
      })
      .with('customer.subscription.updated', async () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const subscription = event.data.object as Stripe.Subscription;

        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;

        if (subscription.items.data[0].price.metadata.plan === STRIPE_PLAN_TYPE.TEAM) {
          const team = await prisma.team.findFirst({
            where: {
              customerId,
            },
          });

          if (!team) {
            return Response.json(
              {
                success: false,
                message: 'No team associated with subscription found',
              } satisfies StripeWebhookResponse,
              { status: 500 },
            );
          }

          await onSubscriptionUpdated({ teamId: team.id, subscription });

          return Response.json(
            { success: true, message: 'Webhook received' } satisfies StripeWebhookResponse,
            { status: 200 },
          );
        }

        const result = await prisma.user.findFirst({
          select: {
            id: true,
          },
          where: {
            customerId,
          },
        });

        if (!result?.id) {
          return Response.json(
            {
              success: false,
              message: 'User not found',
            } satisfies StripeWebhookResponse,
            { status: 500 },
          );
        }

        await onSubscriptionUpdated({ userId: result.id, subscription });

        return Response.json(
          {
            success: true,
            message: 'Webhook received',
          } satisfies StripeWebhookResponse,
          { status: 200 },
        );
      })
      .with('invoice.payment_succeeded', async () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const invoice = event.data.object as Stripe.Invoice;

        if (invoice.billing_reason !== 'subscription_cycle') {
          return Response.json(
            {
              success: true,
              message: 'Webhook received',
            } satisfies StripeWebhookResponse,
            { status: 200 },
          );
        }

        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id;

        if (!customerId || !subscriptionId) {
          return Response.json(
            {
              success: false,
              message: 'Invalid invoice',
            } satisfies StripeWebhookResponse,
            { status: 500 },
          );
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        if (subscription.status === 'incomplete_expired') {
          return Response.json(
            {
              success: true,
              message: 'Webhook received',
            } satisfies StripeWebhookResponse,
            { status: 200 },
          );
        }

        if (subscription.items.data[0].price.metadata.plan === STRIPE_PLAN_TYPE.TEAM) {
          const team = await prisma.team.findFirst({
            where: {
              customerId,
            },
          });

          if (!team) {
            return Response.json(
              {
                success: false,
                message: 'No team associated with subscription found',
              } satisfies StripeWebhookResponse,
              { status: 500 },
            );
          }

          await onSubscriptionUpdated({ teamId: team.id, subscription });

          return Response.json(
            {
              success: true,
              message: 'Webhook received',
            } satisfies StripeWebhookResponse,
            { status: 200 },
          );
        }

        const result = await prisma.user.findFirst({
          select: {
            id: true,
          },
          where: {
            customerId,
          },
        });

        if (!result?.id) {
          return Response.json(
            {
              success: false,
              message: 'User not found',
            } satisfies StripeWebhookResponse,
            { status: 500 },
          );
        }

        await onSubscriptionUpdated({ userId: result.id, subscription });

        return Response.json(
          {
            success: true,
            message: 'Webhook received',
          } satisfies StripeWebhookResponse,
          { status: 200 },
        );
      })
      .with('invoice.payment_failed', async () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const invoice = event.data.object as Stripe.Invoice;

        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id;

        if (!customerId || !subscriptionId) {
          return Response.json(
            {
              success: false,
              message: 'Invalid invoice',
            } satisfies StripeWebhookResponse,
            { status: 500 },
          );
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        if (subscription.status === 'incomplete_expired') {
          return Response.json(
            {
              success: true,
              message: 'Webhook received',
            } satisfies StripeWebhookResponse,
            { status: 200 },
          );
        }

        if (subscription.items.data[0].price.metadata.plan === STRIPE_PLAN_TYPE.TEAM) {
          const team = await prisma.team.findFirst({
            where: {
              customerId,
            },
          });

          if (!team) {
            return Response.json(
              {
                success: false,
                message: 'No team associated with subscription found',
              } satisfies StripeWebhookResponse,
              { status: 500 },
            );
          }

          await onSubscriptionUpdated({ teamId: team.id, subscription });

          return Response.json(
            {
              success: true,
              message: 'Webhook received',
            } satisfies StripeWebhookResponse,
            { status: 200 },
          );
        }

        const result = await prisma.user.findFirst({
          select: {
            id: true,
          },
          where: {
            customerId,
          },
        });

        if (!result?.id) {
          return Response.json(
            {
              success: false,
              message: 'User not found',
            } satisfies StripeWebhookResponse,
            { status: 500 },
          );
        }

        await onSubscriptionUpdated({ userId: result.id, subscription });

        return Response.json(
          {
            success: true,
            message: 'Webhook received',
          } satisfies StripeWebhookResponse,
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

    return Response.json(
      {
        success: false,
        message: 'Unknown error',
      } satisfies StripeWebhookResponse,
      { status: 500 },
    );
  }
};

export type HandleTeamSeatCheckoutOptions = {
  subscription: Stripe.Subscription;
};

const handleTeamSeatCheckout = async ({ subscription }: HandleTeamSeatCheckoutOptions) => {
  if (subscription.metadata?.pendingTeamId === undefined) {
    throw new Error('Missing pending team ID');
  }

  const pendingTeamId = Number(subscription.metadata.pendingTeamId);

  if (Number.isNaN(pendingTeamId)) {
    throw new Error('Invalid pending team ID');
  }

  return await createTeamFromPendingTeam({ pendingTeamId, subscription }).then((team) => team.id);
};
