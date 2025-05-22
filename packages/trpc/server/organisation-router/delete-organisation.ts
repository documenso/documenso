import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
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

    await prisma.organisation.delete({
      where: {
        id: organisation.id,
      },
    });
  });
