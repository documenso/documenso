import type Stripe from 'stripe';

import { stripe } from '@documenso/lib/server-only/stripe';

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
