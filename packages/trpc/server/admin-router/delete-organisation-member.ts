import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
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
        teams: {
          select: {
            id: true,
          },
        },
        members: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation not found',
      });
    }

    const memberToDelete = organisation.members.find((member) => member.id === organisationMemberId);

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

    const teamIds = organisation.teams.map((team) => team.id);

    await prisma.$transaction(async (tx) => {
      // Removing an OrganisationMember cascades the user out of every team in
      // the org via OrganisationGroupMember, but their authored Envelope rows
      // still reference them. Reassign those to the org owner so they remain
      // reachable after the member loses access (mirrors delete-user.ts).
      if (teamIds.length > 0) {
        await tx.envelope.updateMany({
          where: {
            userId: memberToDelete.userId,
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
          id: organisationMemberId,
          organisationId,
        },
      });
    });

    // A member was removed — queue a seat sync to true the Stripe quantity down
    // to the new count (no proration, no credit).
    await jobs.triggerJob({
      name: 'sync.organisation-seats',
      payload: { organisationId },
    });

    await jobs.triggerJob({
      name: 'send.organisation-member-left.email',
      payload: {
        organisationId,
        memberUserId: memberToDelete.userId,
      },
    });
  });
