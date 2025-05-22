import { UserSecurityAuditLogType } from '@prisma/client';
import { OAuth2Client, decodeIdToken } from 'arctic';
import type { Context } from 'hono';
import { deleteCookie } from 'hono/cookie';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { onCreateUserHook } from '@documenso/lib/server-only/user/create-user';
import { prisma } from '@documenso/prisma';

import type { OAuthClientOptions } from '../../config';
import { AuthenticationErrorCode } from '../errors/error-codes';
import { onAuthorize } from './authorizer';
import { getOpenIdConfiguration } from './open-id';

type HandleOAuthCallbackUrlOptions = {
  c: Context;
  clientOptions: OAuthClientOptions;
};

export const handleOAuthCallbackUrl = async (options: HandleOAuthCallbackUrlOptions) => {
  const { c, clientOptions } = options;

  if (!clientOptions.clientId || !clientOptions.clientSecret) {
    throw new AppError(AppErrorCode.NOT_SETUP);
  }

  const { token_endpoint } = await getOpenIdConfiguration(clientOptions.wellKnownUrl, {
    requiredScopes: clientOptions.scope,
  });

  const oAuthClient = new OAuth2Client(
    clientOptions.clientId,
    clientOptions.clientSecret,
    clientOptions.redirectUrl,
  );

  const requestMeta = c.get('requestMetadata');

  const code = c.req.query('code');
  const state = c.req.query('state');

  const storedState = deleteCookie(c, `${clientOptions.id}_oauth_state`);
  const storedCodeVerifier = deleteCookie(c, `${clientOptions.id}_code_verifier`);
  const storedRedirectPath = deleteCookie(c, `${clientOptions.id}_redirect_path`) ?? '';

  if (!code || !storedState || state !== storedState || !storedCodeVerifier) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid or missing state',
    });
  }

  // eslint-disable-next-line prefer-const
  let [redirectState, redirectPath] = storedRedirectPath.split(' ');

  if (redirectState !== storedState || !redirectPath) {
    redirectPath = '/documents';
  }

  const tokens = await oAuthClient.validateAuthorizationCode(
    token_endpoint,
    code,
    storedCodeVerifier,
  );

  const accessToken = tokens.accessToken();
  const accessTokenExpiresAt = tokens.accessTokenExpiresAt();
  const idToken = tokens.idToken();

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const claims = decodeIdToken(tokens.idToken()) as Record<string, unknown>;

  const email = claims.email;
  const name = claims.name;
  const sub = claims.sub;

  if (typeof email !== 'string' || typeof name !== 'string' || typeof sub !== 'string') {
    throw new AppError(AuthenticationErrorCode.InvalidRequest, {
      message: 'Invalid claims',
    });
  }

  if (claims.email_verified !== true && !clientOptions.bypassEmailVerification) {
    throw new AppError(AuthenticationErrorCode.UnverifiedEmail, {
      message: 'Account email is not verified',
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

    return c.redirect(redirectPath, 302);
  }

  const userWithSameEmail = await prisma.user.findFirst({
    where: {
      email: email,
    },
  });

  // Handle existing user but no account.
  if (userWithSameEmail) {
    await prisma.$transaction(async (tx) => {
      await tx.account.create({
        data: {
          type: 'oauth',
          provider: clientOptions.id,
          providerAccountId: sub,
          access_token: accessToken,
          expires_at: Math.floor(accessTokenExpiresAt.getTime() / 1000),
          token_type: 'Bearer',
          id_token: idToken,
          userId: userWithSameEmail.id,
        },
      });

      // Log link event.
      await tx.userSecurityAuditLog.create({
        data: {
          userId: userWithSameEmail.id,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
          type: UserSecurityAuditLogType.ACCOUNT_SSO_LINK,
        },
      });

      // If account already exists in an unverified state, remove the password to ensure
      // they cannot sign in since we cannot confirm the password was set by the user.
      if (!userWithSameEmail.emailVerified) {
        await tx.user.update({
          where: {
            id: userWithSameEmail.id,
          },
          data: {
            emailVerified: new Date(),
            password: null,
            // Todo: (RR7) Will need to update the "password" account after the migration.
          },
        });
      }
    });

    await onAuthorize({ userId: userWithSameEmail.id }, c);

    return c.redirect(redirectPath, 302);
  }

  // Handle new user.
  const createdUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email,
        name: name,
        emailVerified: new Date(),
      },
    });

    await tx.account.create({
      data: {
        type: 'oauth',
        provider: clientOptions.id,
        providerAccountId: sub,
        access_token: accessToken,
        expires_at: Math.floor(accessTokenExpiresAt.getTime() / 1000),
        token_type: 'Bearer',
        id_token: idToken,
        userId: user.id,
      },
    });

    return user;
  });

  await onCreateUserHook(createdUser).catch((err) => {
    // Todo: (RR7) Add logging.
    console.error(err);
  });

  await onAuthorize({ userId: createdUser.id }, c);

  return c.redirect(redirectPath, 302);
};
