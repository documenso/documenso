import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZUpdateAdminOrganisationRequestSchema,
  ZUpdateAdminOrganisationResponseSchema,
} from './update-admin-organisation.types';

export const updateAdminOrganisationRoute = adminProcedure
  .input(ZUpdateAdminOrganisationRequestSchema)
  .output(ZUpdateAdminOrganisationResponseSchema)
  .mutation(async ({ input }) => {
    const { organisationId, data } = input;

    const organisation = await prisma.organisation.findUnique({
      where: {
        id: organisationId,
      },
      include: {
        organisationClaim: true,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    const { name, url, customerId, claims, originalSubscriptionClaimId } = data;

    await prisma.organisation.update({
      where: {
        id: organisationId,
      },
      data: {
        name,
        url,
        customerId: customerId === undefined ? null : customerId,
      },
    });

    await prisma.organisationClaim.update({
      where: {
        id: organisation.organisationClaimId,
      },
      data: {
        ...claims,
        originalSubscriptionClaimId,
      },
    });
  });
