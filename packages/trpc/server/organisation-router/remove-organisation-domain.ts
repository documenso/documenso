import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { removeDomainFromOrganisation } from '@documenso/lib/server-only/organisation/domain-organisation';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZRemoveOrganisationDomainRequestSchema,
  ZRemoveOrganisationDomainResponseSchema,
} from './remove-organisation-domain.types';

export const removeOrganisationDomainRoute = authenticatedProcedure
  .input(ZRemoveOrganisationDomainRequestSchema)
  .output(ZRemoveOrganisationDomainResponseSchema)
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
        message: 'You do not have permission to remove domains from this organisation.',
      });
    }

    const success = await removeDomainFromOrganisation(organisationId, domain, userId);

    if (success) {
      // Log the domain removal
      ctx.logger.info('Domain removed from organisation', {
        organisationId,
        domain,
        userId,
        userName: ctx.user.name,
        userEmail: ctx.user.email,
      });
    }

    return {
      success,
    };
  });
