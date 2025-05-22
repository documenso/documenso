import { unique } from 'remeda';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getMemberOrganisationRole } from '@documenso/lib/server-only/team/get-member-roles';
import {
  buildOrganisationWhereQuery,
  isOrganisationRoleWithinUserHierarchy,
} from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';
import { OrganisationGroupType } from '@documenso/prisma/generated/types';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateOrganisationGroupRequestSchema,
  ZUpdateOrganisationGroupResponseSchema,
} from './update-organisation-group.types';

export const updateOrganisationGroupRoute = authenticatedProcedure
  // .meta(updateOrganisationGroupMeta)
  .input(ZUpdateOrganisationGroupRequestSchema)
  .output(ZUpdateOrganisationGroupResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id, ...data } = input;
    const { user } = ctx;

    const organisationGroup = await prisma.organisationGroup.findFirst({
      where: {
        id,
        organisation: buildOrganisationWhereQuery(
          undefined,
          user.id,
          ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
        ),
      },
      include: {
        organisationGroupMembers: true,
      },
    });

    if (!organisationGroup) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation group not found',
      });
    }

    if (organisationGroup.type === OrganisationGroupType.INTERNAL_ORGANISATION) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to update internal organisation groups',
      });
    }

    const currentUserOrganisationRole = await getMemberOrganisationRole({
      organisationId: organisationGroup.organisationId,
      reference: {
        type: 'User',
        id: user.id,
      },
    });

    if (
      !isOrganisationRoleWithinUserHierarchy(
        currentUserOrganisationRole,
        organisationGroup.organisationRole,
      )
    ) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to update this organisation group',
      });
    }

    if (
      data.organisationRole &&
      !isOrganisationRoleWithinUserHierarchy(currentUserOrganisationRole, data.organisationRole)
    ) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to set an organisation role higher than your own',
      });
    }

    const groupMemberIds = unique(data.memberIds || []);

    const membersToDelete = organisationGroup.organisationGroupMembers.filter(
      (member) => !groupMemberIds.includes(member.organisationMemberId),
    );

    const membersToCreate = groupMemberIds.filter(
      (id) =>
        !organisationGroup.organisationGroupMembers.some(
          (member) => member.organisationMemberId === id,
        ),
    );

    await prisma.$transaction(async (tx) => {
      await tx.organisationGroup.update({
        where: {
          id,
        },
        data: {
          organisationRole: data.organisationRole,
          name: data.name,
        },
      });

      // Only run deletion if memberIds is defined.
      if (data.memberIds && membersToDelete.length > 0) {
        await tx.organisationGroupMember.deleteMany({
          where: {
            groupId: organisationGroup.id,
            organisationMemberId: { in: membersToDelete.map((m) => m.organisationMemberId) },
          },
        });
      }

      // Only run creation if memberIds is defined.
      if (data.memberIds && membersToCreate.length > 0) {
        await tx.organisationGroupMember.createMany({
          data: membersToCreate.map((id) => ({
            groupId: organisationGroup.id,
            organisationMemberId: id,
          })),
        });
      }
    });
  });
