import { IS_BILLING_ENABLED } from '@doku-seal/lib/constants/app';
import { DOKU_SEAL_ENCRYPTION_KEY } from '@doku-seal/lib/constants/crypto';
import { AppError, AppErrorCode } from '@doku-seal/lib/errors/app-error';
import { symmetricDecrypt } from '@doku-seal/lib/universal/crypto';
import { formatOrganisationCallbackUrl } from '@doku-seal/lib/utils/organisation-authentication-portal';
import { prisma } from '@doku-seal/prisma';

type GetOrganisationAuthenticationPortalOptions =
  | {
      type: 'url';
      organisationUrl: string;
    }
  | {
      type: 'id';
      organisationId: string;
    };

export const getOrganisationAuthenticationPortalOptions = async (
  options: GetOrganisationAuthenticationPortalOptions,
) => {
  const organisation = await prisma.organisation.findFirst({
    where:
      options.type === 'url'
        ? {
            url: options.organisationUrl,
          }
        : {
            id: options.organisationId,
          },
    include: {
      organisationClaim: true,
      organisationAuthenticationPortal: true,
      groups: true,
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  if (!IS_BILLING_ENABLED()) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Billing is not enabled',
    });
  }

  if (
    !organisation.organisationClaim.flags.authenticationPortal ||
    !organisation.organisationAuthenticationPortal.enabled
  ) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Authentication portal is not enabled for this organisation',
    });
  }

  const {
    clientId,
    clientSecret: encryptedClientSecret,
    wellKnownUrl,
  } = organisation.organisationAuthenticationPortal;

  if (!clientId || !encryptedClientSecret || !wellKnownUrl) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Authentication portal is not configured for this organisation',
    });
  }

  if (!DOKU_SEAL_ENCRYPTION_KEY) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'Encryption key is not set',
    });
  }

  const clientSecret = Buffer.from(
    symmetricDecrypt({ key: DOKU_SEAL_ENCRYPTION_KEY, data: encryptedClientSecret }),
  ).toString('utf-8');

  return {
    organisation,
    clientId,
    clientSecret,
    wellKnownUrl,
    clientOptions: {
      id: organisation.id,
      scope: ['openid', 'email', 'profile'],
      clientId,
      clientSecret,
      redirectUrl: formatOrganisationCallbackUrl(organisation.url),
      wellKnownUrl,
    },
  };
};
