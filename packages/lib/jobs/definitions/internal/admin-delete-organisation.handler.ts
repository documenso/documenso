import { prisma } from '@documenso/prisma';

import { ORGANISATION_USER_ACCOUNT_TYPE } from '../../../constants/organisations';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { orphanEnvelopes } from '../../../server-only/envelope/orphan-envelopes';
import { sendOrganisationDeleteEmail } from '../../../server-only/organisation/delete-organisation-email';
import { jobs } from '../../client';
import type { JobRunIO } from '../../client/_internal/job';
import type { TAdminDeleteOrganisationJobDefinition } from './admin-delete-organisation';

export const run = async ({ payload, io }: { payload: TAdminDeleteOrganisationJobDefinition; io: JobRunIO }) => {
  const { organisationId, sendEmailToOwner, requestedByUserId } = payload;

  // Get/store the organisation in a task so it can be accessed by subsequent tasks.
  const organisation = await io.runTask('get-organisation', async () => {
    io.logger.info(`User ${requestedByUserId} is deleting organisation ${organisationId}`);

    return await prisma.organisation.findUnique({
      where: {
        id: organisationId,
      },
      select: {
        id: true,
        name: true,
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        teams: {
          select: {
            id: true,
          },
        },
        subscription: {
          select: {
            planId: true,
          },
        },
      },
    });
  });

  if (!organisation) {
    // The organisation may have already been deleted by a prior run / another
    // pathway. Treat as a no-op so the job doesn't retry forever.
    return;
  }

  const ownerEmail = organisation.owner.email;

  const emailContext = await io.runTask('get-email-context', async () => {
    return await getEmailContext({
      emailType: 'INTERNAL',
      source: {
        type: 'organisation',
        organisationId: organisation.id,
      },
    });
  });

  // 1. Orphan all envelopes for every team.
  for (const team of organisation.teams) {
    await io.runTask(`orphan-envelopes--team-${team.id}`, async () => {
      await orphanEnvelopes({ teamId: team.id });
    });
  }

  // 2. Delete the organisation. Matches the transaction in organisation-router/delete-organisation.ts.
  await io.runTask('delete-organisation', async () => {
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
  });

  // 3. Send the owner notification.
  if (sendEmailToOwner) {
    await io.runTask('send-organisation-deleted-email', async () => {
      await sendOrganisationDeleteEmail({
        email: ownerEmail,
        organisationName: organisation.name,
        deletedByAdmin: true,
        emailContext,
      });
    });
  }

  // 4. If the organisation has a Stripe subscription, schedule it to be cancelled at the end of the current billing period.
  if (organisation.subscription) {
    const stripeSubscriptionId = organisation.subscription.planId;

    await jobs.triggerJob({
      name: 'internal.cancel-organisation-subscription',
      payload: {
        stripeSubscriptionId,
        organisationId: organisation.id,
      },
    });
  }
};
