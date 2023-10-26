import { DateTime } from 'luxon';

import { stripe } from '@documenso/lib/server-only/stripe';
import { getFlag } from '@documenso/lib/universal/get-feature-flag';
import { prisma } from '@documenso/prisma';
import { SubscriptionStatus } from '@documenso/prisma/client';

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

  // Since we store details and allow for past due plans we need to check if the subscription is active.
  if (user.Subscription?.status !== SubscriptionStatus.INACTIVE && user.Subscription?.priceId) {
    const { product } = await stripe.prices
      .retrieve(user.Subscription.priceId, {
        expand: ['product'],
      })
      .catch((err) => {
        console.error(err);
        throw err;
      });

    if (typeof product === 'string') {
      throw new Error(ERROR_CODES.SUBSCRIPTION_FETCH_FAILED);
    }

    quota = ZLimitsSchema.parse('metadata' in product ? product.metadata : {});
    remaining = structuredClone(quota);
  }

  const documents = await prisma.document.count({
    where: {
      userId: user.id,
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
