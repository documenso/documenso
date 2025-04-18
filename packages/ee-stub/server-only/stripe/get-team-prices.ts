/**
 * Stub implementation for getting team prices.
 * In the stub version, returns mock price data with the same structure as the production version.
 */

export const getTeamPrices = async () => {
  return {
    monthly: {
      friendlyInterval: 'Monthly',
      interval: 'monthly',
      priceId: 'price_stub_monthly',
      description: 'Team plan monthly subscription',
      features: [],
    },
    yearly: {
      friendlyInterval: 'Yearly',
      interval: 'yearly',
      priceId: 'price_stub_yearly',
      description: 'Team plan yearly subscription',
      features: [],
    },
    priceIds: ['price_stub_monthly', 'price_stub_yearly'],
  };
};

export const getTeamRelatedPrices = async () => {
  return [];
};
