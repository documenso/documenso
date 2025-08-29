import { OrganisationGroupType } from '@prisma/client';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getMemberOrganisationRole } from '@documenso/lib/server-only/team/get-member-roles';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import {
  buildOrganisationWhereQuery,
  isOrganisationRoleWithinUserHierarchy,
} from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateOrganisationGroupRequestSchema,
  ZCreateOrganisationGroupResponseSchema,
} from './create-organisation-group.types';

export const createOrganisationGroupRoute = authenticatedProcedure
  // .meta(createOrganisationGroupMeta)
  .input(ZCreateOrganisationGroupRequestSchema)
  .output(ZCreateOrganisationGroupResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, organisationRole, name, memberIds } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
      include: {
        groups: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    const currentUserOrganisationRole = await getMemberOrganisationRole({
      organisationId,
      reference: {
        type: 'User',
        id: user.id,
      },
    });

    if (!isOrganisationRoleWithinUserHierarchy(currentUserOrganisationRole, organisationRole)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to create this organisation group',
      });
    }

    // Validate that members exist in the organisation.
    memberIds.forEach((memberId) => {
      const member = organisation.members.find(({ id }) => id === memberId);

      if (!member) {
        throw new AppError(AppErrorCode.NOT_FOUND);
      }
    });

    await prisma.$transaction(async (tx) => {
      const group = await tx.organisationGroup.create({
        data: {
          id: generateDatabaseId('org_group'),
          organisationId,
          name,
          type: OrganisationGroupType.CUSTOM,
          organisationRole,
        },
      });

      await tx.organisationGroupMember.createMany({
        data: memberIds.map((memberId) => ({
          id: generateDatabaseId('group_member'),
          organisationMemberId: memberId,
          groupId: group.id,
        })),
      });

      return group;
    });
  });
