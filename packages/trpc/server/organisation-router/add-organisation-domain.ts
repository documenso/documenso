import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { addDomainToOrganisation } from '@documenso/lib/server-only/organisation/domain-organisation';
import { validateAndSecureDomain } from '@documenso/lib/server-only/organisation/domain-security';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZAddOrganisationDomainRequestSchema,
  ZAddOrganisationDomainResponseSchema,
} from './add-organisation-domain.types';

export const addOrganisationDomainRoute = authenticatedProcedure
  .input(ZAddOrganisationDomainRequestSchema)
  .output(ZAddOrganisationDomainResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { organisationId, domain } = input;
    const userId = ctx.user.id;
    const _requestMetadata = extractRequestMetadata(ctx.req);

    ctx.logger.info({
      input: {
        organisationId,
        domain,
      },
    });

    // Verify user has permission to manage organisation domains
    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have permission to add domains to this organisation.',
      });
    }

    // Validate domain security
    const validation = validateAndSecureDomain(domain);

    if (!validation.isValid) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: validation.securityResult.reason,
      });
    }

    const domainAccess = await addDomainToOrganisation(
      organisationId,
      validation.normalizedDomain,
      userId,
    );

    // Log the domain addition
    ctx.logger.info('Domain added to organisation', {
      organisationId,
      domain: validation.normalizedDomain,
      userId,
      userName: ctx.user.name,
      userEmail: ctx.user.email,
    });

    return {
      id: domainAccess.id,
      domain: domainAccess.domain,
      createdAt: domainAccess.createdAt,
      updatedAt: domainAccess.updatedAt,
    };
  });
