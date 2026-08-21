import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import { prisma } from '@documenso/prisma';
import { OrganisationMemberInviteStatus } from '@prisma/client';

import { maybeAuthenticatedProcedure } from '../trpc';
import {
  ZDeclineOrganisationMemberInviteRequestSchema,
  ZDeclineOrganisationMemberInviteResponseSchema,
} from './decline-organisation-member-invite.types';

export const declineOrganisationMemberInviteRoute = maybeAuthenticatedProcedure
  .input(ZDeclineOrganisationMemberInviteRequestSchema)
  .output(ZDeclineOrganisationMemberInviteResponseSchema)
  .mutation(async ({ input }) => {
    const { token } = input;

    const organisationMemberInvite = await prisma.organisationMemberInvite.findFirst({
      where: {
        token,
      },
    });

    if (!organisationMemberInvite) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    // Only a PENDING invite can transition to DECLINED. Guarding on the previous
    // status keeps repeated decline requests idempotent and stops them from
    // re-notifying the organisation managers.
    const { count } = await prisma.organisationMemberInvite.updateMany({
      where: {
        id: organisationMemberInvite.id,
        status: OrganisationMemberInviteStatus.PENDING,
      },
      data: {
        status: OrganisationMemberInviteStatus.DECLINED,
      },
    });

    if (count === 1) {
      await jobs.triggerJob({
        name: 'send.organisation-invite-declined.email',
        payload: {
          organisationId: organisationMemberInvite.organisationId,
          inviteeEmail: organisationMemberInvite.email,
        },
      });
    }
  });
