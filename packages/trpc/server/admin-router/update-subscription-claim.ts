import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobsClient } from '@documenso/lib/jobs/client';
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
  .mutation(async ({ input, ctx }) => {
    const { id, data } = input;

    ctx.logger.info({
      input,
    });

    const existingClaim = await prisma.subscriptionClaim.findUnique({
      where: { id },
    });

    if (!existingClaim) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Subscription claim not found' });
    }

    const newlyEnabledFlags = getNewTruthyFlags(existingClaim.flags, data.flags);

    await prisma.$transaction(async (tx) => {
      await tx.subscriptionClaim.update({
        where: {
          id,
        },
        data,
      });

      if (Object.keys(newlyEnabledFlags).length > 0) {
        await jobsClient.triggerJob({
          name: 'internal.backport-subscription-claims',
          payload: {
            subscriptionClaimId: id,
            flags: newlyEnabledFlags,
          },
        });
      }
    });
  });

function getNewTruthyFlags(
  a: Partial<TClaimFlags>,
  b: Partial<TClaimFlags>,
): Record<keyof TClaimFlags, true> {
  const flags: { [key in keyof TClaimFlags]?: true } = {};

  for (const key in b) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const typedKey = key as keyof TClaimFlags;

    if (b[typedKey] === true && a[typedKey] !== true) {
      flags[typedKey] = true;
    }
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return flags as Record<keyof TClaimFlags, true>;
}
