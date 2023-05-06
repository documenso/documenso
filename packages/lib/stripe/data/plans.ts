export const STRIPE_PLANS = [
  {
    name: "Community Plan (Monthly)",
    period: "monthly",
    price: 30,
    priceId: process.env.NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_MONTHLY_PRICE_ID ?? "",
  },
  {
    name: "Community Plan (Yearly)",
    period: "yearly",
    price: 300,
    priceId: process.env.NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_YEARLY_PRICE_ID ?? "",
  },
];
