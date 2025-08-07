import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { DOCUMENSO_ENCRYPTION_KEY } from '@documenso/lib/constants/crypto';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { symmetricEncrypt } from '@documenso/lib/universal/crypto';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateOrganisationAuthenticationPortalRequestSchema,
  ZUpdateOrganisationAuthenticationPortalResponseSchema,
} from './update-organisation-authentication-portal.types';

export const updateOrganisationAuthenticationPortalRoute = authenticatedProcedure
  .input(ZUpdateOrganisationAuthenticationPortalRequestSchema)
  .output(ZUpdateOrganisationAuthenticationPortalResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, data } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
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
        organisationAuthenticationPortal: true,
        organisationClaim: true,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED);
    }

    if (!organisation.organisationClaim.flags.authenticationPortal) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Authentication portal is not allowed for this organisation',
      });
    }

    const {
      defaultOrganisationRole,
      enabled,
      clientId,
      clientSecret,
      wellKnownUrl,
      autoProvisionUsers,
      allowedDomains,
    } = data;

    if (
      enabled &&
      (!wellKnownUrl ||
        !clientId ||
        (!clientSecret && !organisation.organisationAuthenticationPortal.clientSecret))
    ) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message:
          'Client ID, client secret, and well known URL are required when authentication portal is enabled',
      });
    }

    // Allow empty string to be passed in to remove the client secret from the database.
    let encryptedClientSecret: string | undefined = clientSecret;

    // Encrypt the secret if it is provided.
    if (clientSecret) {
      const encryptionKey = DOCUMENSO_ENCRYPTION_KEY;

      if (!encryptionKey) {
        throw new Error('Missing DOCUMENSO_ENCRYPTION_KEY');
      }

      encryptedClientSecret = symmetricEncrypt({
        key: encryptionKey,
        data: clientSecret,
      });
    }

    await prisma.organisationAuthenticationPortal.update({
      where: {
        id: organisation.organisationAuthenticationPortal.id,
      },
      data: {
        defaultOrganisationRole,
        enabled,
        clientId,
        clientSecret: encryptedClientSecret,
        wellKnownUrl,
        autoProvisionUsers,
        allowedDomains,
      },
    });
  });
