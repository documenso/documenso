import { DateTime } from 'luxon';

import { getFlag } from '@documenso/lib/universal/get-feature-flag';
import { prisma } from '@documenso/prisma';
import { SubscriptionStatus } from '@documenso/prisma/client';

import { getPricesByType } from '../stripe/get-prices-by-type';
import { FREE_PLAN_LIMITS, SELFHOSTED_PLAN_LIMITS } from './constants';
import { ERROR_CODES } from './errors';
import { ZLimitsSchema } from './schema';

export type GetServerLimitsOptions = {
  email?: string | null;
};

export const getServerLimits = async ({ email }: GetServerLimitsOptions) => {
  const isBillingEnabled = await getFlag('app_billing');

  if (!isBillingEnabled) {
    return {
      quota: SELFHOSTED_PLAN_LIMITS,
      remaining: SELFHOSTED_PLAN_LIMITS,
    };
  }

  if (!email) {
    throw new Error(ERROR_CODES.UNAUTHORIZED);
  }

  const user = await prisma.user.findFirst({
    where: {
      email,
    },
    include: {
      Subscription: true,
    },
  });

  if (!user) {
    throw new Error(ERROR_CODES.USER_FETCH_FAILED);
  }

  let quota = structuredClone(FREE_PLAN_LIMITS);
  let remaining = structuredClone(FREE_PLAN_LIMITS);

  const activeSubscriptions = user.Subscription.filter(
    ({ status }) => status === SubscriptionStatus.ACTIVE,
  );

  if (activeSubscriptions.length > 0) {
    const individualPrices = await getPricesByType('individual');

    for (const subscription of activeSubscriptions) {
      const price = individualPrices.find((price) => price.id === subscription.priceId);
      if (!price || typeof price.product === 'string' || price.product.deleted) {
        continue;
      }

      const currentQuota = ZLimitsSchema.parse(
        'metadata' in price.product ? price.product.metadata : {},
      );

      // Use the subscription with the highest quota.
      if (currentQuota.documents > quota.documents && currentQuota.recipients > quota.recipients) {
        quota = currentQuota;
        remaining = structuredClone(quota);
      }
    }
  }

  const documents = await prisma.document.count({
    where: {
      userId: user.id,
      teamId: null,
      createdAt: {
        gte: DateTime.utc().startOf('month').toJSDate(),
      },
    },
  });

  remaining.documents = Math.max(remaining.documents - documents, 0);

  return {
    quota,
    remaining,
  };
};
