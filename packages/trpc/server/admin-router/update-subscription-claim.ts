import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TClaimFlags } from '@documenso/lib/types/subscription';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZUpdateSubscriptionClaimRequestSchema,
  ZUpdateSubscriptionClaimResponseSchema,
} from './update-subscription-claim.types';

export const updateSubscriptionClaimRoute = adminProcedure
  .input(ZUpdateSubscriptionClaimRequestSchema)
  .output(ZUpdateSubscriptionClaimResponseSchema)
  .mutation(async ({ input }) => {
    const { id, data } = input;

    const existingClaim = await prisma.subscriptionClaim.findUnique({
      where: { id },
    });

    if (!existingClaim) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Subscription claim not found' });
    }

    const newlyEnabledFlags = getNewTruthyKeys(existingClaim.flags, data.flags);

    console.log({
      newlyEnabledFlags,
    });

    if (newlyEnabledFlags.length > 0) {
      // Todo: orgs backport claims
    }

    await prisma.subscriptionClaim.update({
      where: {
        id,
      },
      data,
    });
  });

type BoolMap = Record<string, boolean | undefined>;

/**
 * Get the new truthy keys from the existing flags and the new flags.
 *
 * @param a - The existing flags.
 * @param b - The new flags.
 * @returns The new truthy keys.
 */
function getNewTruthyKeys(a: BoolMap, b: BoolMap): (keyof TClaimFlags)[] {
  return Object.entries(b)
    .filter(([key, value]) => value && !a[key])
    .map(([key]) => key as keyof TClaimFlags);
}
