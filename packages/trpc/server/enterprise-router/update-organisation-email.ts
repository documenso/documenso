import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateOrganisationEmailRequestSchema,
  ZUpdateOrganisationEmailResponseSchema,
} from './update-organisation-email.types';

export const updateOrganisationEmailRoute = authenticatedProcedure
  .input(ZUpdateOrganisationEmailRequestSchema)
  .output(ZUpdateOrganisationEmailResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { emailId, emailName } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        emailId,
      },
    });

    const organisationEmail = await prisma.organisationEmail.findFirst({
      where: {
        id: emailId,
        organisation: buildOrganisationWhereQuery({
          organisationId: undefined,
          userId: user.id,
          roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
        }),
      },
    });

    if (!organisationEmail) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    await prisma.organisationEmail.update({
      where: {
        id: emailId,
      },
      data: {
        emailName,
        // replyTo,
      },
    });
  });
