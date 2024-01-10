import { stripe } from '@documenso/lib/server-only/stripe';

export type UpdateSubscriptionItemQuantityOptions = {
  subscriptionId: string;
  quantity?: number;
  priceId: string;
};

export const updateSubscriptionItemQuantity = async ({
  subscriptionId,
  quantity,
  priceId,
}: UpdateSubscriptionItemQuantityOptions) => {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const items = subscription.items.data.filter((item) => item.price.id === priceId);

  if (items.length === 0) {
    return;
  }

  await stripe.subscriptions.update(subscriptionId, {
    items: items.map((item) => ({
      id: item.id,
      quantity,
    })),
  });
};
