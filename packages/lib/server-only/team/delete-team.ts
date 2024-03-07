import { prisma } from '@documenso/prisma';

import { AppError } from '../../errors/app-error';
import { stripe } from '../stripe';

export type DeleteTeamOptions = {
  userId: number;
  teamId: number;
};

export const deleteTeam = async ({ userId, teamId }: DeleteTeamOptions) => {
  await prisma.$transaction(
    async (tx) => {
      const team = await tx.team.findFirstOrThrow({
        where: {
          id: teamId,
          ownerUserId: userId,
        },
        include: {
          subscription: true,
        },
      });

      if (team.subscription) {
        await stripe.subscriptions
          .cancel(team.subscription.planId, {
            prorate: false,
            invoice_now: true,
          })
          .catch((err) => {
            console.error(err);
            throw AppError.parseError(err);
          });
      }

      await tx.team.delete({
        where: {
          id: teamId,
          ownerUserId: userId,
        },
      });
    },
    { timeout: 30_000 },
  );
};
