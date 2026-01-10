import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
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

export const SUBSCRIPTION_STATUS_MAP: Record<SubscriptionStatus, MessageDescriptor> = {
  [SubscriptionStatus.ACTIVE]: msg`Active`,
  [SubscriptionStatus.INACTIVE]: msg`Inactive`,
  [SubscriptionStatus.PAST_DUE]: msg`Past Due`,
};
