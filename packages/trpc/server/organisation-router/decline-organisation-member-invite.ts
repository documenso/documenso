import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { OrganisationMemberInviteStatus } from '@prisma/client';

import { maybeAuthenticatedProcedure } from '../trpc';
import { twoFactorRemediation } from '../two-factor-enforcement/enforce';
import {
  ZDeclineOrganisationMemberInviteRequestSchema,
  ZDeclineOrganisationMemberInviteResponseSchema,
} from './decline-organisation-member-invite.types';

export const declineOrganisationMemberInviteRoute = maybeAuthenticatedProcedure
  .input(ZDeclineOrganisationMemberInviteRequestSchema)
  .output(ZDeclineOrganisationMemberInviteResponseSchema)
  // 2FA enforcement: REMEDIATION — a member must always be able to walk away; declining an invite must never be blocked. Instance assert still applies.
  .use(twoFactorRemediation())
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
