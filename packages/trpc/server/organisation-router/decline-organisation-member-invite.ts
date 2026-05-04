import { OrganisationMemberInviteStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import { prisma } from '@documenso/prisma';

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

    if (organisationMemberInvite.status === OrganisationMemberInviteStatus.DECLINED) {
      return;
    }

    if (organisationMemberInvite.status !== OrganisationMemberInviteStatus.PENDING) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Only pending invitations can be declined',
      });
    }

    await prisma.organisationMemberInvite.update({
      where: {
        id: organisationMemberInvite.id,
      },
      data: {
        status: OrganisationMemberInviteStatus.DECLINED,
      },
    });

    await jobs.triggerJob({
      name: 'send.organisation-member-invite-declined.email',
      payload: {
        organisationId: organisationMemberInvite.organisationId,
        inviteId: organisationMemberInvite.id,
        inviteeEmail: organisationMemberInvite.email,
      },
    });
  });
