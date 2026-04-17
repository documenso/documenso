import { syncMemberCountWithStripeSeatPlan } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';
import { OrganisationMemberInviteStatus } from '@documenso/prisma/client';

import { authenticatedProcedure } from '../trpc';
import {
  ZLeaveOrganisationRequestSchema,
  ZLeaveOrganisationResponseSchema,
} from './leave-organisation.types';

export const leaveOrganisationRoute = authenticatedProcedure
  .input(ZLeaveOrganisationRequestSchema)
  .output(ZLeaveOrganisationResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { organisationId } = input;
    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({ organisationId, userId }),
      include: {
        organisationClaim: true,
        subscription: true,
        invites: {
          where: {
            status: OrganisationMemberInviteStatus.PENDING,
          },
          select: {
            id: true,
          },
        },
        members: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    const { organisationClaim } = organisation;

    const inviteCount = organisation.invites.length;
    const newMemberCount = organisation.members.length + inviteCount - 1;

    // Leaving is a reducing operation, so we don't gate it on the subscription
    // being present. Sync Stripe only when one exists.
    if (organisation.subscription) {
      await syncMemberCountWithStripeSeatPlan(
        organisation.subscription,
        organisationClaim,
        newMemberCount,
      );
    }

    await prisma.organisationMember.delete({
      where: {
        userId_organisationId: {
          userId,
          organisationId,
        },
      },
    });

    await jobs.triggerJob({
      name: 'send.organisation-member-left.email',
      payload: {
        organisationId: organisation.id,
        memberUserId: userId,
      },
    });
  });
