import { prisma } from '@documenso/prisma';

import { ORGANISATION_USER_ACCOUNT_TYPE } from '../../constants/organisations';
import { jobs } from '../../jobs/client';
import { orphanEnvelopes } from '../envelope/orphan-envelopes';

export type DeleteOrganisationOptions = {
  organisation: {
    id: string;
    teams: { id: number }[];
    subscription: { planId: string } | null;
  };
};

/**
 * Fully tears down an organisation:
 *
 * 1. Orphans every team's envelopes (so foreign key constraints don't block the delete).
 * 2. Removes the organisation's account rows and the organisation itself in a transaction.
 * 3. Schedules the Stripe subscription to be cancelled at the end of the billing period
 *    (when one exists). The job runs asynchronously so a Stripe outage doesn't block the
 *    delete, and is retried by the job runner if Stripe is temporarily unavailable.
 *
 * Authorization must be handled by the caller. This is the shared implementation used by
 * the organisation delete route, the admin delete-organisation job, and account deletion.
 */
export const deleteOrganisation = async ({ organisation }: DeleteOrganisationOptions) => {
  // Orphan all envelopes to get rid of foreign key constraints.
  await Promise.all(organisation.teams.map(async (team) => orphanEnvelopes({ teamId: team.id })));

  await prisma.$transaction(async (tx) => {
    await tx.account.deleteMany({
      where: {
        type: ORGANISATION_USER_ACCOUNT_TYPE,
        provider: organisation.id,
      },
    });

    await tx.organisation.delete({
      where: {
        id: organisation.id,
      },
    });
  });

  if (organisation.subscription) {
    await jobs.triggerJob({
      name: 'internal.cancel-organisation-subscription',
      payload: {
        stripeSubscriptionId: organisation.subscription.planId,
        organisationId: organisation.id,
      },
    });
  }
};
