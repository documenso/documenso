import { getCheckoutSession } from '@documenso/ee/server-only/stripe/get-checkout-session';
import { getTeamPrices } from '@documenso/ee/server-only/stripe/get-team-prices';
import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

export type CreateTeamPendingCheckoutSession = {
  userId: number;
  pendingTeamId: number;
  interval: 'monthly' | 'yearly';
};

export const createTeamPendingCheckoutSession = async ({
  userId,
  pendingTeamId,
  interval,
}: CreateTeamPendingCheckoutSession) => {
  const teamPendingCreation = await prisma.teamPending.findFirstOrThrow({
    where: {
      id: pendingTeamId,
      ownerUserId: userId,
    },
    include: {
      owner: true,
    },
  });

  const prices = await getTeamPrices();
  const priceId = prices[interval].priceId;

  try {
    const stripeCheckoutSession = await getCheckoutSession({
      customerId: teamPendingCreation.customerId,
      priceId,
      returnUrl: `${WEBAPP_BASE_URL}/settings/teams`,
      subscriptionMetadata: {
        pendingTeamId: pendingTeamId.toString(),
      },
    });

    if (!stripeCheckoutSession) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR);
    }

    return stripeCheckoutSession;
  } catch (e) {
    console.error(e);

    // Absorb all the errors incase Stripe throws something sensitive.
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, 'Something went wrong.');
  }
};
