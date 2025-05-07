import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createPersonalOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteOrganisationRequestSchema,
  ZDeleteOrganisationResponseSchema,
} from './delete-organisation.types';

export const deleteOrganisationRoute = authenticatedProcedure
  //   .meta(deleteOrganisationMeta)
  .input(ZDeleteOrganisationRequestSchema)
  .output(ZDeleteOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId } = input;
    const { user } = ctx;

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery(
        organisationId,
        user.id,
        ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['DELETE_ORGANISATION'],
      ),
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not authorized to delete this organisation',
      });
    }

    const numberOfOrganisationsOwnerHas = await prisma.organisation.count({
      where: {
        ownerUserId: organisation.ownerUserId,
      },
    });

    // Create an empty organisation for owner since their only one is being deleted.
    if (numberOfOrganisationsOwnerHas === 1) {
      await createPersonalOrganisation({
        userId: organisation.ownerUserId,
        throwErrorOnOrganisationCreationFailure: true,
      });
    }

    await prisma.organisation.delete({
      where: {
        id: organisation.id,
      },
    });
  });
