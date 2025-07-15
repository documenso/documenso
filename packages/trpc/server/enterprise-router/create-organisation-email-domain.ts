import { createEmailDomain } from '@documenso/ee/server-only/lib/create-email-domain';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
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

    ctx.logger.info({
      input: {
        organisationId,
        domain,
      },
    });

    if (!IS_BILLING_ENABLED()) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Billing is not enabled',
      });
    }

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
      include: {
        emailDomains: true,
        organisationClaim: true,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    if (!organisation.organisationClaim.flags.emailDomains) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Email domains are not enabled for this organisation',
      });
    }

    if (organisation.emailDomains.length >= 100) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'You have reached the maximum number of email domains',
      });
    }

    return await createEmailDomain({
      domain,
      organisationId,
    });
  });
