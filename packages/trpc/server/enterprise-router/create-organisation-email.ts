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
    const { emailName, emailPrefix, emailDomainId } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        emailDomainId,
      },
    });

    const emailDomain = await prisma.emailDomain.findFirst({
      where: {
        id: emailDomainId,
        organisation: buildOrganisationWhereQuery({
          organisationId: undefined,
          userId: user.id,
          roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
        }),
      },
    });

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
        organisationId: emailDomain.organisationId,
        emailName,
        // replyTo,
        email,
        emailDomainId,
      },
    });
  });
