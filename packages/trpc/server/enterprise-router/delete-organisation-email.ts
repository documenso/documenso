import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteOrganisationEmailRequestSchema,
  ZDeleteOrganisationEmailResponseSchema,
} from './delete-organisation-email.types';

export const deleteOrganisationEmailRoute = authenticatedProcedure
  .input(ZDeleteOrganisationEmailRequestSchema)
  .output(ZDeleteOrganisationEmailResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { emailId } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        emailId,
      },
    });

    const email = await prisma.organisationEmail.findFirst({
      where: {
        id: emailId,
        organisation: buildOrganisationWhereQuery({
          organisationId: undefined,
          userId: user.id,
          roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
        }),
      },
    });

    if (!email) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    await prisma.organisationEmail.delete({
      where: {
        id: email.id,
      },
    });
  });
