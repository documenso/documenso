/**
 * Stub implementation for getting team prices.
 * In the stub version, returns a predefined structure with monthly and yearly options.
 */

export const getTeamPrices = async () => {
  return {
    monthly: [
      {
        priceId: 'price_monthly_stub',
        interval: 'monthly',
        friendlyInterval: 'Monthly',
        unitAmount: 5000, // $50.00
        quantity: 5,
        currency: 'usd',
      },
    ],
    yearly: [
      {
        priceId: 'price_yearly_stub',
        interval: 'yearly',
        friendlyInterval: 'Yearly',
        unitAmount: 48000, // $480.00
        quantity: 5,
        currency: 'usd',
      },
    ],
  };
};
