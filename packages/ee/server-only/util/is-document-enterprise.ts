import type { Subscription } from '@prisma/client';

import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { subscriptionsContainsActivePlan } from '@documenso/lib/utils/billing';
import { prisma } from '@documenso/prisma';

import { getEnterprisePlanPriceIds } from '../stripe/get-enterprise-plan-prices';

export type IsUserEnterpriseOptions = {
  userId: number;
  teamId?: number;
};

/**
 * Whether the user is enterprise, or has permission to use enterprise features on
 * behalf of their team.
 *
 * It is assumed that the provided user is part of the provided team.
 */
export const isUserEnterprise = async ({
  userId,
  teamId,
}: IsUserEnterpriseOptions): Promise<boolean> => {
  let subscriptions: Subscription[] = [];

  if (!IS_BILLING_ENABLED()) {
    return false;
  }

  if (teamId) {
    subscriptions = await prisma.team
      .findFirstOrThrow({
        where: {
          id: teamId,
        },
        select: {
          owner: {
            include: {
              subscriptions: true,
            },
          },
        },
      })
      .then((team) => team.owner.subscriptions);
  } else {
    subscriptions = await prisma.user
      .findFirstOrThrow({
        where: {
          id: userId,
        },
        select: {
          subscriptions: true,
        },
      })
      .then((user) => user.subscriptions);
  }

  if (subscriptions.length === 0) {
    return false;
  }

  const enterprisePlanPriceIds = await getEnterprisePlanPriceIds();

  return subscriptionsContainsActivePlan(subscriptions, enterprisePlanPriceIds, true);
};
