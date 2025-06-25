import { z } from 'zod';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateOrganisationEmailRequestSchema,
  ZCreateOrganisationEmailResponseSchema,
} from './create-organisation-email.types';

export const createOrganisationEmailRoute = authenticatedProcedure
  .input(ZCreateOrganisationEmailRequestSchema)
  .output(ZCreateOrganisationEmailResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, emailName, emailPrefix, emailDomainId, replyTo } = input;
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

    const email = `${emailPrefix}@${emailDomain.domain}`;

    const isValid = z.string().email().safeParse(email);

    if (!isValid.success) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Invalid email address',
      });
    }

    await prisma.organisationEmail.create({
      data: {
        id: generateDatabaseId('org_email'),
        organisationId,
        emailName,
        replyTo,
        email,
        emailDomainId,
      },
    });
  });
