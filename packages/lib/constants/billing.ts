import { SubscriptionStatus } from '@prisma/client';

export enum STRIPE_PLAN_TYPE {
  FREE = 'free',
  INDIVIDUAL = 'individual',
  PRO = 'pro',
  EARLY_ADOPTER = 'earlyAdopter',
  PLATFORM = 'platform',
  ENTERPRISE = 'enterprise',
}

export const FREE_TIER_DOCUMENT_QUOTA = 5;

export const SUBSCRIPTION_STATUS_MAP = {
  [SubscriptionStatus.ACTIVE]: 'Active',
  [SubscriptionStatus.INACTIVE]: 'Inactive',
  [SubscriptionStatus.PAST_DUE]: 'Past Due',
};
