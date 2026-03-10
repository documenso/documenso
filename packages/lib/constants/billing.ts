import { msg } from '@lingui/core/macro';
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
  [SubscriptionStatus.ACTIVE]: msg({
    message: 'Active',
    context: 'Subscription status',
  }),
  [SubscriptionStatus.INACTIVE]: msg({
    message: 'Inactive',
    context: 'Subscription status',
  }),
  [SubscriptionStatus.PAST_DUE]: msg({
    message: 'Past Due',
    context: 'Subscription status',
  }),
};
