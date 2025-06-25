import { createEmailDomain } from '@documenso/ee/server-only/lib/create-email-domain';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateOrganisationEmailDomainRequestSchema,
  ZCreateOrganisationEmailDomainResponseSchema,
} from './create-organisation-email-domain.types';

export const createOrganisationEmailDomainRoute = authenticatedProcedure
  .input(ZCreateOrganisationEmailDomainRequestSchema)
  .output(ZCreateOrganisationEmailDomainResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, domain } = input;
    const { user } = ctx;

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
      include: {
        emailDomains: true,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    // Todo: (email)
    if (organisation.emailDomains.length >= 10) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'You have reached the maximum number of email domains',
      });
    }

    return await createEmailDomain({
      domain,
      organisationId,
    });
  });
