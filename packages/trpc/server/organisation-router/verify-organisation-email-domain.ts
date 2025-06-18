import { EmailDomainStatus } from '@prisma/client';

import { verifyEmailDomain } from '@documenso/ee/server-only/lib/verify-email-domain';
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

    if (organisation.emailDomains.length == 0) {
      return;
    }

    // Filter down emails to verify to those that are pending or if we only want
    // to verify a specific email.
    const emailsToVerify = organisation.emailDomains.filter((email) => {
      if (emailDomainId) {
        return email.id === emailDomainId;
      }

      return email.status === EmailDomainStatus.PENDING;
    });

    await Promise.all(emailsToVerify.map(async (email) => verifyEmailDomain(email.id)));
  });
