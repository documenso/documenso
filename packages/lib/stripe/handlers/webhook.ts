import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@documenso/prisma";
import { stripe } from "../client";
import { SubscriptionStatus } from "@prisma/client";
import { buffer } from "micro";
import Stripe from "stripe";

const log = (...args: any[]) => console.log("[stripe]", ...args);

export const webhookHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!process.env.NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS) {
    return res.status(500).json({
      success: false,
      message: "Subscriptions are not enabled",
    });
  }

  const sig =
    typeof req.headers["stripe-signature"] === "string" ? req.headers["stripe-signature"] : "";

  if (!sig) {
    return res.status(400).json({
      success: false,
      message: "No signature found in request",
    });
  }

  const body = await buffer(req);

  const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  log("event-type:", event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;

    await prisma.subscription.upsert({
      where: {
        customerId,
      },
      create: {
        customerId,
        status: SubscriptionStatus.ACTIVE,
        planId: subscription.id,
        priceId: subscription.items.data[0].price.id,
        periodEnd: new Date(subscription.current_period_end * 1000),
        userId: Number(session.client_reference_id as string),
      },
      update: {
        customerId,
        status: SubscriptionStatus.ACTIVE,
        planId: subscription.id,
        priceId: subscription.items.data[0].price.id,
        periodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Webhook received",
    });
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;

    if (invoice.billing_reason !== "subscription_cycle") {
      return res.status(200).json({
        success: true,
        message: "Webhook received",
      });
    }

    const customerId =
      typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

    const hasSubscription = await prisma.subscription.findFirst({
      where: {
        customerId,
      },
    });

    if (hasSubscription) {
      await prisma.subscription.update({
        where: {
          customerId,
        },
        data: {
          status: SubscriptionStatus.ACTIVE,
          planId: subscription.id,
          priceId: subscription.items.data[0].price.id,
          periodEnd: new Date(subscription.current_period_end * 1000),
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Webhook received",
    });
  }

  if (event.type === "invoice.payment_failed") {
    const failedInvoice = event.data.object as Stripe.Invoice;

    const customerId = failedInvoice.customer as string;

    const hasSubscription = await prisma.subscription.findFirst({
      where: {
        customerId,
      },
    });

    if (hasSubscription) {
      await prisma.subscription.update({
        where: {
          customerId,
        },
        data: {
          status: SubscriptionStatus.PAST_DUE,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Webhook received",
    });
  }

  if (event.type === "customer.subscription.updated") {
    const updatedSubscription = event.data.object as Stripe.Subscription;

    const customerId = updatedSubscription.customer as string;

    const hasSubscription = await prisma.subscription.findFirst({
      where: {
        customerId,
      },
    });

    if (hasSubscription) {
      await prisma.subscription.update({
        where: {
          customerId,
        },
        data: {
          status: SubscriptionStatus.ACTIVE,
          planId: updatedSubscription.id,
          priceId: updatedSubscription.items.data[0].price.id,
          periodEnd: new Date(updatedSubscription.current_period_end * 1000),
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Webhook received",
    });
  }

  if (event.type === "customer.subscription.deleted") {
    const deletedSubscription = event.data.object as Stripe.Subscription;

    const customerId = deletedSubscription.customer as string;

    const hasSubscription = await prisma.subscription.findFirst({
      where: {
        customerId,
      },
    });

    if (hasSubscription) {
      await prisma.subscription.update({
        where: {
          customerId,
        },
        data: {
          status: SubscriptionStatus.INACTIVE,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Webhook received",
    });
  }

  log("Unhandled webhook event", event.type);
  return res.status(400).json({
    success: false,
    message: "Unhandled webhook event",
  });
};
