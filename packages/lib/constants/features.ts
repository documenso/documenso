/* eslint-disable turbo/no-undeclared-env-vars */
export const IS_SUBSCRIPTIONS_ENABLED = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED === 'true';

export const isSubscriptionsEnabled = () =>
  process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED === 'true';
