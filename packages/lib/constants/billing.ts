import { env } from 'next-runtime-env';

export enum STRIPE_CUSTOMER_TYPE {
  INDIVIDUAL = 'individual',
  TEAM = 'team',
}

export enum STRIPE_PLAN_TYPE {
  TEAM = 'team',
  COMMUNITY = 'community',
  ENTERPRISE = 'enterprise',
}

export const STRIPE_COMMUNITY_PLAN_PRODUCT_ID = () =>
  env('NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_PRODUCT_ID');
