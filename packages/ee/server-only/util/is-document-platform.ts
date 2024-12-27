import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { subscriptionsContainsActivePlan } from '@documenso/lib/utils/billing';
import { prisma } from '@documenso/prisma';
import type { Document, Subscription } from '@documenso/prisma/client';

import { getPlatformPlanPriceIds } from '../stripe/get-platform-plan-prices';

export type IsDocumentPlatformOptions = Pick<Document, 'id' | 'userId' | 'teamId'>;

/**
 * Whether the user is platform, or has permission to use platform features on
 * behalf of their team.
 *
 * It is assumed that the provided user is part of the provided team.
 */
export const isDocumentPlatform = async ({
  userId,
  teamId,
}: IsDocumentPlatformOptions): Promise<boolean> => {
  let subscriptions: Subscription[] = [];

  if (!IS_BILLING_ENABLED()) {
    return true;
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
              Subscription: true,
            },
          },
        },
      })
      .then((team) => team.owner.Subscription);
  } else {
    subscriptions = await prisma.user
      .findFirstOrThrow({
        where: {
          id: userId,
        },
        select: {
          Subscription: true,
        },
      })
      .then((user) => user.Subscription);
  }

  if (subscriptions.length === 0) {
    return false;
  }

  const platformPlanPriceIds = await getPlatformPlanPriceIds();

  return subscriptionsContainsActivePlan(subscriptions, platformPlanPriceIds);
};
