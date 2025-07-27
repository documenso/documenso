import { verifyEmailDomain } from '@documenso/ee/server-only/lib/verify-email-domain';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZVerifyOrganisationEmailDomainRequestSchema,
  ZVerifyOrganisationEmailDomainResponseSchema,
} from './verify-organisation-email-domain.types';

export const verifyOrganisationEmailDomainRoute = authenticatedProcedure
  .input(ZVerifyOrganisationEmailDomainRequestSchema)
  .output(ZVerifyOrganisationEmailDomainResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, emailDomainId } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
        emailDomainId,
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
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    // Filter down emails to verify a specific email, otherwise verify all emails regardless of status.
    const emailsToVerify = organisation.emailDomains.filter((email) => {
      if (emailDomainId && email.id !== emailDomainId) {
        return false;
      }

      return true;
    });

    await Promise.all(emailsToVerify.map(async (email) => verifyEmailDomain(email.id)));
  });
