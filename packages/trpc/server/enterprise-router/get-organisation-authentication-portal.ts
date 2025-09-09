import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetOrganisationAuthenticationPortalRequestSchema,
  ZGetOrganisationAuthenticationPortalResponseSchema,
} from './get-organisation-authentication-portal.types';

export const getOrganisationAuthenticationPortalRoute = authenticatedProcedure
  .input(ZGetOrganisationAuthenticationPortalRequestSchema)
  .output(ZGetOrganisationAuthenticationPortalResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId } = input;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    return await getOrganisationAuthenticationPortal({
      userId: ctx.user.id,
      organisationId,
    });
  });

type GetOrganisationAuthenticationPortalOptions = {
  userId: number;
  organisationId: string;
};

export const getOrganisationAuthenticationPortal = async ({
  userId,
  organisationId,
}: GetOrganisationAuthenticationPortalOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
    include: {
      organisationClaim: true,
      organisationAuthenticationPortal: {
        select: {
          defaultOrganisationRole: true,
          enabled: true,
          clientId: true,
          wellKnownUrl: true,
          autoProvisionUsers: true,
          allowedDomains: true,
          clientSecret: true,
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  if (!organisation.organisationClaim.flags.authenticationPortal) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Authentication portal not found',
    });
  }

  const portal = organisation.organisationAuthenticationPortal;

  return {
    defaultOrganisationRole: portal.defaultOrganisationRole,
    enabled: portal.enabled,
    clientId: portal.clientId,
    wellKnownUrl: portal.wellKnownUrl,
    autoProvisionUsers: portal.autoProvisionUsers,
    allowedDomains: portal.allowedDomains,
    clientSecretProvided: Boolean(portal.clientSecret),
  };
};
