import type { Subscription } from '@prisma/client';

import { subscriptionsContainsActivePlan } from '@documenso/lib/utils/billing';
import { prisma } from '@documenso/prisma';

import { getCommunityPlanPriceIds } from '../stripe/get-community-plan-prices';

export type IsCommunityPlanOptions = {
  userId: number;
  teamId?: number;
};

/**
 * Whether the user or team is on the community plan.
 */
export const isCommunityPlan = async ({
  userId,
  teamId,
}: IsCommunityPlanOptions): Promise<boolean> => {
  let subscriptions: Subscription[] = [];

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

  const communityPlanPriceIds = await getCommunityPlanPriceIds();

  return subscriptionsContainsActivePlan(subscriptions, communityPlanPriceIds);
};
