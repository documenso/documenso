import { getCheckoutSession } from '@documenso/ee/server-only/stripe/get-checkout-session';
import { getStripeCustomerIdByUser } from '@documenso/ee/server-only/stripe/get-customer';
import { prisma } from '@documenso/prisma';

import { WEBAPP_BASE_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { getTeamSeatPriceId } from '../../utils/billing';

export type CreateTeamPendingCheckoutSession = {
  userId: number;
  pendingTeamId: number;
};

export const createTeamPendingCheckoutSession = async ({
  userId,
  pendingTeamId,
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

  const stripeCustomerId = await getStripeCustomerIdByUser(teamPendingCreation.owner);

  try {
    const stripeCheckoutSession = await getCheckoutSession({
      customerId: stripeCustomerId,
      priceId: getTeamSeatPriceId(),
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

    // Absorb all the errors incase stripe throws something sensitive.
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, 'Something went wrong.');
  }
};
