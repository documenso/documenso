import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../../errors/app-error';
import type { JobRunIO } from '../../client/_internal/job';
import type { TBackportSubscriptionClaimJobDefinition } from './backport-subscription-claims';

export const run = async ({
  payload,
  io,
}: {
  payload: TBackportSubscriptionClaimJobDefinition;
  io: JobRunIO;
}) => {
  const { subscriptionClaimId, flags } = payload;

  const subscriptionClaim = await prisma.subscriptionClaim.findFirst({
    where: {
      id: subscriptionClaimId,
    },
  });

  if (!subscriptionClaim) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Subscription claim not found' });
  }

  await io.runTask('backport-claims', async () => {
    const newFlagsJson = JSON.stringify(flags);

    await prisma.$executeRaw`
      UPDATE "OrganisationClaim"
      SET "flags" = "flags" || ${newFlagsJson}::jsonb
      WHERE "originalSubscriptionClaimId" = ${subscriptionClaimId}
    `;
  });
};
