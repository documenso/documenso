import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetOrganisationEmailDomainRequestSchema,
  ZGetOrganisationEmailDomainResponseSchema,
} from './get-organisation-email-domain.types';

export const getOrganisationEmailDomainRoute = authenticatedProcedure
  .input(ZGetOrganisationEmailDomainRequestSchema)
  .output(ZGetOrganisationEmailDomainResponseSchema)
  .query(async ({ input, ctx }) => {
    const { emailDomainId } = input;

    ctx.logger.info({
      input: {
        emailDomainId,
      },
    });

    return await getOrganisationEmailDomain({
      userId: ctx.user.id,
      emailDomainId,
    });
  });

type GetOrganisationEmailDomainOptions = {
  userId: number;
  emailDomainId: string;
};

export const getOrganisationEmailDomain = async ({
  userId,
  emailDomainId,
}: GetOrganisationEmailDomainOptions) => {
  const emailDomain = await prisma.emailDomain.findFirst({
    where: {
      id: emailDomainId,
      organisation: buildOrganisationWhereQuery({
        organisationId: undefined,
        userId,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    },
    omit: {
      privateKey: true,
    },
    include: {
      emails: true,
    },
  });

  if (!emailDomain) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Email domain not found',
    });
  }

  return emailDomain;
};
