import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { stripe } from '@documenso/lib/server-only/stripe';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { authenticatedProcedure } from '../trpc';
import { ZUpdateOrganisationRequestSchema, ZUpdateOrganisationResponseSchema } from './update-organisation.types';

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

    const updatedOrganisation = await prisma.organisation
      .update({
        where: {
          id: organisationId,
        },
        data: {
          name: data.name,
          url: data.url,
        },
      })
      .catch((err) => {
        console.error(err);

        if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
          throw err;
        }

        const target = z.array(z.string()).safeParse(err.meta?.target);

        if (err.code === 'P2002' && target.success && target.data.includes('url')) {
          throw new AppError(AppErrorCode.ALREADY_EXISTS, {
            message: 'Organisation URL already exists.',
          });
        }

        throw err;
      });

    if (updatedOrganisation.customerId) {
      await stripe.customers.update(updatedOrganisation.customerId, {
        metadata: {
          organisationName: data.name,
        },
      });
    }
  });
