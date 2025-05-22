import { OrganisationGroupType } from '@prisma/client';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  buildOrganisationWhereQuery,
  getHighestOrganisationRoleInGroup,
  isOrganisationRoleWithinUserHierarchy,
} from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateOrganisationMemberRequestSchema,
  ZUpdateOrganisationMemberResponseSchema,
} from './update-organisation-members.types';

export const updateOrganisationMemberRoute = authenticatedProcedure
  //   .meta(updateOrganisationMemberMeta)
  .input(ZUpdateOrganisationMemberRequestSchema)
  .output(ZUpdateOrganisationMemberResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { organisationId, organisationMemberId, data } = input;
    const userId = ctx.user.id;

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery(
        organisationId,
        userId,
        ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      ),
      include: {
        groups: {
          where: {
            type: OrganisationGroupType.INTERNAL_ORGANISATION,
          },
        },
        members: {
          include: {
            organisationGroupMembers: {
              include: {
                group: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Organisation not found' });
    }

    const currentOrganisationMember = organisation.members.find(
      (member) => member.userId === userId,
    );

    const organisationMemberToUpdate = organisation.members.find(
      (member) => member.id === organisationMemberId,
    );

    if (!organisationMemberToUpdate || !currentOrganisationMember) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Organisation member does not exist' });
    }

    if (organisationMemberToUpdate.userId === organisation.ownerUserId) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, { message: 'Cannot update the owner' });
    }

    const currentUserOrganisationRoles = currentOrganisationMember.organisationGroupMembers.filter(
      ({ group }) => group.type === OrganisationGroupType.INTERNAL_ORGANISATION,
    );

    if (currentUserOrganisationRoles.length !== 1) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Current user has multiple internal organisation roles',
      });
    }

    const currentUserOrganisationRole = currentUserOrganisationRoles[0].group.organisationRole;
    const currentMemberToUpdateOrganisationRole = getHighestOrganisationRoleInGroup(
      organisationMemberToUpdate.organisationGroupMembers.flatMap((member) => member.group),
    );

    const isMemberToUpdateHigherRole = !isOrganisationRoleWithinUserHierarchy(
      currentUserOrganisationRole,
      currentMemberToUpdateOrganisationRole,
    );

    if (isMemberToUpdateHigherRole) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot update a member with a higher role',
      });
    }

    const isNewMemberRoleHigherThanCurrentRole = !isOrganisationRoleWithinUserHierarchy(
      currentUserOrganisationRole,
      data.role,
    );

    if (isNewMemberRoleHigherThanCurrentRole) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Cannot give a member a role higher than the user initating the update',
      });
    }

    const currentMemberGroup = organisation.groups.find(
      (group) => group.organisationRole === currentMemberToUpdateOrganisationRole,
    );

    const newMemberGroup = organisation.groups.find(
      (group) => group.organisationRole === data.role,
    );

    if (!currentMemberGroup) {
      console.error('[CRITICAL]: Missing internal group');

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Current member group not found',
      });
    }

    if (!newMemberGroup) {
      console.error('[CRITICAL]: Missing internal group');

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'New member group not found',
      });
    }

    // Switch member to new internal group role.
    await prisma.$transaction(async (tx) => {
      await tx.organisationGroupMember.delete({
        where: {
          organisationMemberId_groupId: {
            organisationMemberId: organisationMemberToUpdate.id,
            groupId: currentMemberGroup.id,
          },
        },
      });

      await tx.organisationGroupMember.create({
        data: {
          organisationMemberId: organisationMemberToUpdate.id,
          groupId: newMemberGroup.id,
        },
      });
    });
  });
