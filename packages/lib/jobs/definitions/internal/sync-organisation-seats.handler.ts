import { syncMemberCountWithStripeSeatPlan } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { prisma } from '@documenso/prisma';
import { SubscriptionStatus } from '@prisma/client';
import { IS_BILLING_ENABLED } from '../../../constants/app';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSyncOrganisationSeatsJobDefinition } from './sync-organisation-seats';

export const run = async ({ payload }: { payload: TSyncOrganisationSeatsJobDefinition; io: JobRunIO }) => {
  const { organisationId } = payload;

  if (!IS_BILLING_ENABLED()) {
    return;
  }

  const organisation = await prisma.organisation.findUnique({
    where: {
      id: organisationId,
    },
    include: {
      subscription: true,
      organisationClaim: true,
    },
  });

  if (!organisation || !organisation.subscription) {
    return;
  }

  // Skip canceled/terminal subscriptions — Stripe rejects quantity updates on a
  // canceled subscription. PAST_DUE is still live and a no-proration shrink is
  // safe, so it's allowed through.
  if (organisation.subscription.status === SubscriptionStatus.INACTIVE) {
    return;
  }

  const memberCount = await prisma.organisationMember.count({
    where: {
      organisationId,
    },
  });

  // An organisation always retains its owner; guarding zero avoids writing the
  // unlimited sentinel to the claim.
  if (memberCount === 0) {
    return;
  }

  await syncMemberCountWithStripeSeatPlan(
    organisation.subscription,
    organisation.organisationClaim,
    memberCount,
    'shrink',
  );
};
