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
        teams: {
          select: {
            id: true,
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

    const teamIds = organisation.teams.map((team) => team.id);

    await prisma.$transaction(async (tx) => {
      // Leaving the org cascades the user out of every team via
      // OrganisationGroupMember, but their authored Envelope rows still
      // reference them. Reassign those to the org owner so they remain
      // reachable after the member loses access (mirrors delete-user.ts).
      if (teamIds.length > 0) {
        await tx.envelope.updateMany({
          where: {
            userId,
            teamId: {
              in: teamIds,
            },
          },
          data: {
            userId: organisation.ownerUserId,
          },
        });
      }

      await tx.organisationMember.delete({
        where: {
          userId_organisationId: {
            userId,
            organisationId,
          },
        },
      });
    });

    await jobs.triggerJob({
      name: 'send.organisation-member-left.email',
      payload: {
        organisationId: organisation.id,
        memberUserId: userId,
      },
    });
  });
