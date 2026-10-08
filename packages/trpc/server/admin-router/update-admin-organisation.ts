import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import { hasOrganisationLimitsChanged } from '@documenso/lib/universal/organisation-limit-changes';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZUpdateAdminOrganisationRequestSchema,
  ZUpdateAdminOrganisationResponseSchema,
} from './update-admin-organisation.types';

export const updateAdminOrganisationRoute = adminProcedure
  .input(ZUpdateAdminOrganisationRequestSchema)
  .output(ZUpdateAdminOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, data, notifyOrganisation } = input;

    ctx.logger.info({
      input: {
        organisationId,
        notifyOrganisation,
      },
    });

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

    const isLimitsChanged = claims ? hasOrganisationLimitsChanged(organisation.organisationClaim, claims) : false;

    await prisma.organisation.update({
      where: {
        id: organisationId,
      },
      data: {
        name,
        url,
        customerId: customerId ? customerId : undefined,
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

    if (!notifyOrganisation) {
      return { isNotificationSent: false };
    }

    if (!isLimitsChanged) {
      ctx.logger.info({
        msg: 'Skipping organisation limits updated email, no limits changed',
        organisationId,
      });

      return { isNotificationSent: false };
    }

    await jobs.triggerJob({
      name: 'send.organisation-limits-updated.email',
      payload: {
        organisationId,
      },
    });

    return { isNotificationSent: true };
  });
