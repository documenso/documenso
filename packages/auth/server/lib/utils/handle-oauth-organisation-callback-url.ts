import type { Context } from 'hono';

import { sendOrganisationAccountLinkConfirmationEmail } from '@documenso/ee/server-only/lib/send-organisation-account-link-confirmation-email';
import { AppError } from '@documenso/lib/errors/app-error';
import { onCreateUserHook } from '@documenso/lib/server-only/user/create-user';
import { formatOrganisationLoginUrl } from '@documenso/lib/utils/organisation-authentication-portal';
import { prisma } from '@documenso/prisma';

import { AuthenticationErrorCode } from '../errors/error-codes';
import { onAuthorize } from './authorizer';
import { validateOauth } from './handle-oauth-callback-url';
import { getOrganisationAuthenticationPortalOptions } from './organisation-portal';

type HandleOAuthOrganisationCallbackUrlOptions = {
  c: Context;
  orgUrl: string;
};

export const handleOAuthOrganisationCallbackUrl = async (
  options: HandleOAuthOrganisationCallbackUrlOptions,
) => {
  const { c, orgUrl } = options;

  const { organisation, clientOptions } = await getOrganisationAuthenticationPortalOptions({
    type: 'url',
    organisationUrl: orgUrl,
  });

  const { email, name, sub, accessToken, accessTokenExpiresAt, idToken } = await validateOauth({
    c,
    clientOptions: {
      ...clientOptions,
      bypassEmailVerification: true, // Bypass for organisation OIDC because we manually verify the email.
    },
  });

  const allowedDomains = organisation.organisationAuthenticationPortal.allowedDomains;

  if (allowedDomains.length > 0 && !allowedDomains.some((domain) => email.endsWith(`@${domain}`))) {
    throw new AppError(AuthenticationErrorCode.InvalidRequest, {
      message: 'Email domain not allowed',
    });
  }

  // Find the account if possible.
  const existingAccount = await prisma.account.findFirst({
    where: {
      provider: clientOptions.id,
      providerAccountId: sub,
    },
    include: {
      user: true,
    },
  });

  // Directly log in user if account already exists.
  if (existingAccount) {
    await onAuthorize({ userId: existingAccount.user.id }, c);

    return c.redirect(`/o/${orgUrl}`, 302);
  }

  let userToLink = await prisma.user.findFirst({
    where: {
      email,
    },
  });

  // Handle new user.
  if (!userToLink) {
    userToLink = await prisma.user.create({
      data: {
        email: email,
        name: name,
        emailVerified: null, // Do not verify email.
      },
    });

    await onCreateUserHook(userToLink).catch((err) => {
      // Todo: (RR7) Add logging.
      console.error(err);
    });
  }

  await sendOrganisationAccountLinkConfirmationEmail({
    type: userToLink.emailVerified ? 'link' : 'create',
    userId: userToLink.id,
    organisationId: organisation.id,
    organisationName: organisation.name,
    oauthConfig: {
      accessToken,
      idToken,
      providerAccountId: sub,
      expiresAt: Math.floor(accessTokenExpiresAt.getTime() / 1000),
    },
  });

  return c.redirect(`${formatOrganisationLoginUrl(orgUrl)}?action=verification-required`, 302);
};
