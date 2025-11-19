import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@doku-seal/lib/constants/organisations';
import { AppError, AppErrorCode } from '@doku-seal/lib/errors/app-error';
import { stripe } from '@doku-seal/lib/server-only/stripe';
import { buildOrganisationWhereQuery } from '@doku-seal/lib/utils/organisations';
import { prisma } from '@doku-seal/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateOrganisationRequestSchema,
  ZUpdateOrganisationResponseSchema,
} from './update-organisation.types';

export const updateOrganisationRoute = authenticatedProcedure
  //   .meta(updateOrganisationMeta)
  .input(ZUpdateOrganisationRequestSchema)
  .output(ZUpdateOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, data } = input;
    const userId = ctx.user.id;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    // Check if organisation exists and user has access to it
    const existingOrganisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    if (!existingOrganisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation not found',
      });
    }

    const updatedOrganisation = await prisma.organisation.update({
      where: {
        id: organisationId,
      },
      data: {
        name: data.name,
        url: data.url,
      },
    });

    if (updatedOrganisation.customerId) {
      await stripe.customers.update(updatedOrganisation.customerId, {
        metadata: {
          organisationName: data.name,
        },
      });
    }
  });
