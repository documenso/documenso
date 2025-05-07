import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteOrganisationMemberInvitesRequestSchema,
  ZDeleteOrganisationMemberInvitesResponseSchema,
} from './delete-organisation-member-invites.types';

export const deleteOrganisationMemberInvitesRoute = authenticatedProcedure
  //   .meta(deleteOrganisationMemberInvitesMeta)
  .input(ZDeleteOrganisationMemberInvitesRequestSchema)
  .output(ZDeleteOrganisationMemberInvitesResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { organisationId, invitationIds } = input;
    const userId = ctx.user.id;

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery(
        organisationId,
        userId,
        ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      ),
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    await prisma.organisationMemberInvite.deleteMany({
      where: {
        id: {
          in: invitationIds,
        },
        organisationId,
      },
    });
  });
