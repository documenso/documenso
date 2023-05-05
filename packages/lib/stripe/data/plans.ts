export const STRIPE_PLANS = [
  {
    name: "Community Plan",
    period: "monthly",
    priceId: process.env.STRIPE_COMMUNITY_PLAN_MONTHLY_PRICE_ID ?? "",
  },
  {
    name: "Community Plan",
    period: "yearly",
    priceId: process.env.STRIPE_COMMUNITY_PLAN_YEARLY_PRICE_ID ?? "",
  },
];
