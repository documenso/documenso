import { OrganisationGroupType } from '@prisma/client';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
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

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery(
        organisationId,
        user.id,
        ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      ),
      include: {
        groups: true,
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    // const currentUserOrganisationRole = getHighestOrganisationRoleInGroup()
    // Todo: orgs check roles

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
          organisationId,
          name,
          type: OrganisationGroupType.CUSTOM,
          organisationRole,
        },
      });

      await tx.organisationGroupMember.createMany({
        data: memberIds.map((memberId) => ({
          organisationMemberId: memberId,
          groupId: group.id,
        })),
      });

      return group;
    });
  });
