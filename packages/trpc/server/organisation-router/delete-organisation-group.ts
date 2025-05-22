import { OrganisationGroupType } from '@prisma/client';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteOrganisationGroupRequestSchema,
  ZDeleteOrganisationGroupResponseSchema,
} from './delete-organisation-group.types';

export const deleteOrganisationGroupRoute = authenticatedProcedure
  // .meta(deleteOrganisationGroupMeta)
  .input(ZDeleteOrganisationGroupRequestSchema)
  .output(ZDeleteOrganisationGroupResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { groupId, organisationId } = input;
    const { user } = ctx;

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery(
        organisationId,
        user.id,
        ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      ),
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    const group = await prisma.organisationGroup.findFirst({
      where: {
        id: groupId,
        organisation: {
          id: organisationId,
        },
      },
    });

    if (!group) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation group not found',
      });
    }

    if (
      group.type === OrganisationGroupType.INTERNAL_ORGANISATION ||
      group.type === OrganisationGroupType.INTERNAL_TEAM
    ) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not allowed to delete internal groups',
      });
    }

    await prisma.organisationGroup.delete({
      where: {
        id: groupId,
        organisationId: organisation.id,
      },
    });
  });
