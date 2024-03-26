import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { subscriptionsContainActiveEnterprisePlan } from '@documenso/lib/utils/billing';
import { prisma } from '@documenso/prisma';
import type { Subscription } from '@documenso/prisma/client';

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

  return subscriptionsContainActiveEnterprisePlan(subscriptions);
};
