export const STRIPE_PLANS = [
  {
    name: "Community Plan",
    prices: {
      monthly: {
        price: 30,
        priceId: process.env.NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_MONTHLY_PRICE_ID ?? "",
      },
      yearly: {
        price: 300,
        priceId: process.env.NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_YEARLY_PRICE_ID ?? "",
      },
    },
  },
];
