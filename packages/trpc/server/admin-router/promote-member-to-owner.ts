import { OrganisationGroupType, OrganisationMemberRole } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { getHighestOrganisationRoleInGroup } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZPromoteMemberToOwnerRequestSchema,
  ZPromoteMemberToOwnerResponseSchema,
} from './promote-member-to-owner.types';

export const promoteMemberToOwnerRoute = adminProcedure
  .input(ZPromoteMemberToOwnerRequestSchema)
  .output(ZPromoteMemberToOwnerResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, userId } = input;

    ctx.logger.info({
      input: {
        organisationId,
        userId,
      },
    });

    // First, verify the organisation exists and get member details with groups
    const organisation = await prisma.organisation.findUnique({
      where: {
        id: organisationId,
      },
      include: {
        groups: {
          where: {
            type: OrganisationGroupType.INTERNAL_ORGANISATION,
          },
        },
        members: {
          where: {
            userId,
          },
          include: {
            organisationGroupMembers: {
              include: {
                group: true,
              },
            },
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation not found',
      });
    }

    // Verify the user is a member of the organisation
    const [member] = organisation.members;

    if (!member) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'User is not a member of this organisation',
      });
    }

    // Verify the user is not already the owner
    if (organisation.ownerUserId === userId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'User is already the owner of this organisation',
      });
    }

    // Get current organisation role
    const currentOrganisationRole = getHighestOrganisationRoleInGroup(
      member.organisationGroupMembers.flatMap((member) => member.group),
    );

    // Find the current and target organisation groups
    const currentMemberGroup = organisation.groups.find(
      (group) => group.organisationRole === currentOrganisationRole,
    );

    const adminGroup = organisation.groups.find(
      (group) => group.organisationRole === OrganisationMemberRole.ADMIN,
    );

    if (!currentMemberGroup) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Current member group not found',
      });
    }

    if (!adminGroup) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Admin group not found',
      });
    }

    // Update the organisation owner and member role in a transaction
    await prisma.$transaction(async (tx) => {
      // Update the organisation to set the new owner
      await tx.organisation.update({
        where: {
          id: organisationId,
        },
        data: {
          ownerUserId: userId,
        },
      });

      // Only update role if the user is not already an admin then add them to the admin group
      if (currentOrganisationRole !== OrganisationMemberRole.ADMIN) {
        await tx.organisationGroupMember.create({
          data: {
            id: generateDatabaseId('group_member'),
            organisationMemberId: member.id,
            groupId: adminGroup.id,
          },
        });
      }
    });
  });
