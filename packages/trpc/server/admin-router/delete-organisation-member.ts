import { OrganisationMemberInviteStatus } from '@prisma/client';

import { syncMemberCountWithStripeSeatPlan } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import { validateIfSubscriptionIsRequired } from '@documenso/lib/utils/billing';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZDeleteAdminOrganisationMemberRequestSchema,
  ZDeleteAdminOrganisationMemberResponseSchema,
} from './delete-organisation-member.types';

export const deleteAdminOrganisationMemberRoute = adminProcedure
  .input(ZDeleteAdminOrganisationMemberRequestSchema)
  .output(ZDeleteAdminOrganisationMemberResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { organisationId, organisationMemberId } = input;

    ctx.logger.info({
      input: {
        organisationId,
        organisationMemberId,
      },
    });

    const organisation = await prisma.organisation.findUnique({
      where: {
        id: organisationId,
      },
      include: {
        subscription: true,
        organisationClaim: true,
        members: {
          select: {
            id: true,
            userId: true,
          },
        },
        invites: {
          where: {
            status: OrganisationMemberInviteStatus.PENDING,
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation not found',
      });
    }

    const memberToDelete = organisation.members.find(
      (member) => member.id === organisationMemberId,
    );

    if (!memberToDelete) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Member not found in this organisation',
      });
    }

    if (memberToDelete.userId === organisation.ownerUserId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Cannot remove the organisation owner. Transfer ownership first.',
      });
    }

    const subscription = validateIfSubscriptionIsRequired(organisation.subscription);

    const newMemberCount = organisation.members.length + organisation.invites.length - 1;

    if (subscription) {
      await syncMemberCountWithStripeSeatPlan(
        subscription,
        organisation.organisationClaim,
        newMemberCount,
      );
    }

    await prisma.organisationMember.delete({
      where: {
        id: organisationMemberId,
        organisationId,
      },
    });

    await jobs.triggerJob({
      name: 'send.organisation-member-left.email',
      payload: {
        organisationId,
        memberUserId: memberToDelete.userId,
      },
    });
  });
