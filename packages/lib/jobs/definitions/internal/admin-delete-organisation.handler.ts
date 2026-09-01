import { prisma } from '@documenso/prisma';

import { getEmailContext } from '../../../server-only/email/get-email-context';
import { deleteOrganisation } from '../../../server-only/organisation/delete-organisation';
import { sendOrganisationDeleteEmail } from '../../../server-only/organisation/delete-organisation-email';
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
    const { emailTransport: _emailTransport, ...serializableContext } = await getEmailContext({
      emailType: 'INTERNAL',
      source: {
        type: 'organisation',
        organisationId: organisation.id,
      },
    });

    return serializableContext;
  });

  // 1. Orphan envelopes, delete the organisation, and schedule the Stripe
  // subscription cancellation. Shared with organisation-router/delete-organisation.ts.
  await io.runTask('delete-organisation', async () => {
    await deleteOrganisation({ organisation });
  });

  // 2. Send the owner notification.
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
};
