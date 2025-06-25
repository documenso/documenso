import { deleteEmailDomain } from '@documenso/ee/server-only/lib/delete-email-domain';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteOrganisationEmailDomainRequestSchema,
  ZDeleteOrganisationEmailDomainResponseSchema,
} from './delete-organisation-email-domain.types';

export const deleteOrganisationEmailDomainRoute = authenticatedProcedure
  .input(ZDeleteOrganisationEmailDomainRequestSchema)
  .output(ZDeleteOrganisationEmailDomainResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { emailDomainId, organisationId } = input;
    const { user } = ctx;

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
      include: {
        emailDomains: {
          where: {
            id: emailDomainId,
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    const emailDomain = organisation.emailDomains[0];

    if (!emailDomain) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Email domain not found',
      });
    }

    await deleteEmailDomain({
      emailDomainId: emailDomain.id,
    });
  });
