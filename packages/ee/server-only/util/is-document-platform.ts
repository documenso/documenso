import type { Document, Subscription } from '@prisma/client';

import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { subscriptionsContainsActivePlan } from '@documenso/lib/utils/billing';
import { prisma } from '@documenso/prisma';

import { getPlatformPlanPriceIds } from '../stripe/get-platform-plan-prices';

export type IsDocumentPlatformOptions = Pick<Document, 'userId' | 'teamId'>;

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

  const platformPlanPriceIds = await getPlatformPlanPriceIds();

  return subscriptionsContainsActivePlan(subscriptions, platformPlanPriceIds);
};
