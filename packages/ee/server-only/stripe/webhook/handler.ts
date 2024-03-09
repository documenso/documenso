import type { NextApiRequest, NextApiResponse } from 'next';

import { buffer } from 'micro';
import { match } from 'ts-pattern';

import { STRIPE_PLAN_TYPE } from '@documenso/lib/constants/billing';
import type { Stripe } from '@documenso/lib/server-only/stripe';
import { stripe } from '@documenso/lib/server-only/stripe';
import { createTeamFromPendingTeam } from '@documenso/lib/server-only/team/create-team';
import { getFlag } from '@documenso/lib/universal/get-feature-flag';
import { prisma } from '@documenso/prisma';

import { onEarlyAdoptersCheckout } from './on-early-adopters-checkout';
import { onSubscriptionDeleted } from './on-subscription-deleted';
import { onSubscriptionUpdated } from './on-subscription-updated';

type StripeWebhookResponse = {
  success: boolean;
  message: string;
};

export const stripeWebhookHandler = async (
  req: NextApiRequest,
  res: NextApiResponse<StripeWebhookResponse>,
) => {
  try {
    const isBillingEnabled = await getFlag('app_billing');

    if (!isBillingEnabled) {
      return res.status(500).json({
        success: false,
        message: 'Billing is disabled',
      });
    }

    const signature =
      typeof req.headers['stripe-signature'] === 'string' ? req.headers['stripe-signature'] : '';

    if (!signature) {
      return res.status(400).json({
        success: false,
        message: 'No signature found in request',
      });
    }

    const body = await buffer(req);

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET,
    );

    await match(event.type)
      .with('checkout.session.completed', async () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.metadata?.source === 'marketing') {
          await onEarlyAdoptersCheckout({ session });
        }

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
          return res.status(500).json({
            success: false,
            message: 'Invalid session',
          });
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Handle team creation after seat checkout.
        if (subscription.items.data[0].price.metadata.plan === STRIPE_PLAN_TYPE.TEAM) {
          await handleTeamSeatCheckout({ subscription });

          return res.status(200).json({
            success: true,
            message: 'Webhook received',
          });
        }

        // Validate user ID.
        if (!userId || Number.isNaN(userId)) {
          return res.status(500).json({
            success: false,
            message: 'Invalid session or missing user ID',
          });
        }

        await onSubscriptionUpdated({ userId, subscription });

        return res.status(200).json({
          success: true,
          message: 'Webhook received',
        });
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
            return res.status(500).json({
              success: false,
              message: 'No team associated with subscription found',
            });
          }

          await onSubscriptionUpdated({ teamId: team.id, subscription });

          return res.status(200).json({
            success: true,
            message: 'Webhook received',
          });
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
          return res.status(500).json({
            success: false,
            message: 'User not found',
          });
        }

        await onSubscriptionUpdated({ userId: result.id, subscription });

        return res.status(200).json({
          success: true,
          message: 'Webhook received',
        });
      })
      .with('invoice.payment_succeeded', async () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const invoice = event.data.object as Stripe.Invoice;

        if (invoice.billing_reason !== 'subscription_cycle') {
          return res.status(200).json({
            success: true,
            message: 'Webhook received',
          });
        }

        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id;

        if (!customerId || !subscriptionId) {
          return res.status(500).json({
            success: false,
            message: 'Invalid invoice',
          });
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        if (subscription.status === 'incomplete_expired') {
          return res.status(200).json({
            success: true,
            message: 'Webhook received',
          });
        }

        if (subscription.items.data[0].price.metadata.plan === STRIPE_PLAN_TYPE.TEAM) {
          const team = await prisma.team.findFirst({
            where: {
              customerId,
            },
          });

          if (!team) {
            return res.status(500).json({
              success: false,
              message: 'No team associated with subscription found',
            });
          }

          await onSubscriptionUpdated({ teamId: team.id, subscription });

          return res.status(200).json({
            success: true,
            message: 'Webhook received',
          });
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
          return res.status(500).json({
            success: false,
            message: 'User not found',
          });
        }

        await onSubscriptionUpdated({ userId: result.id, subscription });

        return res.status(200).json({
          success: true,
          message: 'Webhook received',
        });
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
          return res.status(500).json({
            success: false,
            message: 'Invalid invoice',
          });
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        if (subscription.status === 'incomplete_expired') {
          return res.status(200).json({
            success: true,
            message: 'Webhook received',
          });
        }

        if (subscription.items.data[0].price.metadata.plan === STRIPE_PLAN_TYPE.TEAM) {
          const team = await prisma.team.findFirst({
            where: {
              customerId,
            },
          });

          if (!team) {
            return res.status(500).json({
              success: false,
              message: 'No team associated with subscription found',
            });
          }

          await onSubscriptionUpdated({ teamId: team.id, subscription });

          return res.status(200).json({
            success: true,
            message: 'Webhook received',
          });
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
          return res.status(500).json({
            success: false,
            message: 'User not found',
          });
        }

        await onSubscriptionUpdated({ userId: result.id, subscription });

        return res.status(200).json({
          success: true,
          message: 'Webhook received',
        });
      })
      .with('customer.subscription.deleted', async () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const subscription = event.data.object as Stripe.Subscription;

        await onSubscriptionDeleted({ subscription });

        return res.status(200).json({
          success: true,
          message: 'Webhook received',
        });
      })
      .otherwise(() => {
        return res.status(200).json({
          success: true,
          message: 'Webhook received',
        });
      });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: 'Unknown error',
    });
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
