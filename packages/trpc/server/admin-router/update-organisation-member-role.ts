import { OrganisationGroupType, OrganisationMemberRole } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { getHighestOrganisationRoleInGroup } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZUpdateOrganisationMemberRoleRequestSchema,
  ZUpdateOrganisationMemberRoleResponseSchema,
} from './update-organisation-member-role.types';

/**
 * Admin mutation to update organisation member role or transfer ownership.
 *
 * This mutation handles two scenarios:
 * 1. When role='OWNER': Transfers organisation ownership and promotes to ADMIN
 * 2. When role=ADMIN/MANAGER/MEMBER: Updates group membership
 *
 * Admin privileges bypass normal hierarchy restrictions.
 */
export const updateOrganisationMemberRoleRoute = adminProcedure
  .input(ZUpdateOrganisationMemberRoleRequestSchema)
  .output(ZUpdateOrganisationMemberRoleResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, userId, role } = input;

    ctx.logger.info({
      input: {
        organisationId,
        userId,
        role,
      },
    });

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

    const [member] = organisation.members;

    if (!member) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'User is not a member of this organisation',
      });
    }

    const currentOrganisationRole = getHighestOrganisationRoleInGroup(
      member.organisationGroupMembers.flatMap((member) => member.group),
    );

    if (role === 'OWNER') {
      if (organisation.ownerUserId === userId) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'User is already the owner of this organisation',
        });
      }

      const currentMemberGroup = organisation.groups.find(
        (group) => group.organisationRole === currentOrganisationRole,
      );

      const adminGroup = organisation.groups.find(
        (group) => group.organisationRole === OrganisationMemberRole.ADMIN,
      );

      if (!currentMemberGroup) {
        ctx.logger.error({
          message: '[CRITICAL]: Missing internal group',
          organisationId,
          userId,
          role: currentOrganisationRole,
        });

        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'Current member group not found',
        });
      }

      if (!adminGroup) {
        ctx.logger.error({
          message: '[CRITICAL]: Missing internal group',
          organisationId,
          userId,
          targetRole: 'ADMIN',
        });

        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'Admin group not found',
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.organisation.update({
          where: {
            id: organisationId,
          },
          data: {
            ownerUserId: userId,
          },
        });

        if (currentOrganisationRole !== OrganisationMemberRole.ADMIN) {
          await tx.organisationGroupMember.delete({
            where: {
              organisationMemberId_groupId: {
                organisationMemberId: member.id,
                groupId: currentMemberGroup.id,
              },
            },
          });

          await tx.organisationGroupMember.create({
            data: {
              id: generateDatabaseId('group_member'),
              organisationMemberId: member.id,
              groupId: adminGroup.id,
            },
          });
        }
      });

      return;
    }

    const targetRole = role as OrganisationMemberRole;

    if (currentOrganisationRole === targetRole) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'User already has this role',
      });
    }

    if (userId === organisation.ownerUserId && targetRole !== OrganisationMemberRole.ADMIN) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Organisation owner must be an admin. Transfer ownership first.',
      });
    }

    const currentMemberGroup = organisation.groups.find(
      (group) => group.organisationRole === currentOrganisationRole,
    );

    const newMemberGroup = organisation.groups.find(
      (group) => group.organisationRole === targetRole,
    );

    if (!currentMemberGroup) {
      ctx.logger.error({
        message: '[CRITICAL]: Missing internal group',
        organisationId,
        userId,
        role: currentOrganisationRole,
      });

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Current member group not found',
      });
    }

    if (!newMemberGroup) {
      ctx.logger.error({
        message: '[CRITICAL]: Missing internal group',
        organisationId,
        userId,
        targetRole,
      });

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'New member group not found',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.organisationGroupMember.delete({
        where: {
          organisationMemberId_groupId: {
            organisationMemberId: member.id,
            groupId: currentMemberGroup.id,
          },
        },
      });

      await tx.organisationGroupMember.create({
        data: {
          id: generateDatabaseId('group_member'),
          organisationMemberId: member.id,
          groupId: newMemberGroup.id,
        },
      });
    });
  });
