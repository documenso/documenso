import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import { ZDeleteOrganisationRequestSchema, ZDeleteOrganisationResponseSchema } from './delete-organisation.types';

export const deleteOrganisationRoute = adminProcedure
  .input(ZDeleteOrganisationRequestSchema)
  .output(ZDeleteOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, organisationName, sendEmailToOwner } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
        sendEmailToOwner,
      },
    });

    const organisation = await prisma.organisation.findUnique({
      where: {
        id: organisationId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation not found',
      });
    }

    if (organisation.name !== organisationName) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Organisation name does not match',
      });
    }

    // The deletion itself is offloaded to a background job because orphaning
    // potentially-large numbers of envelopes can take a while.
    await jobs.triggerJob({
      name: 'internal.admin-delete-organisation',
      payload: {
        organisationId: organisation.id,
        sendEmailToOwner,
        requestedByUserId: user.id,
      },
    });
  });
