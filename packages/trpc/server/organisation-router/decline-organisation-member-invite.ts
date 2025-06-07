import { OrganisationMemberInviteStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
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

    await prisma.organisationMemberInvite.update({
      where: {
        id: organisationMemberInvite.id,
      },
      data: {
        status: OrganisationMemberInviteStatus.DECLINED,
      },
    });

    // TODO: notify the team owner
  });
