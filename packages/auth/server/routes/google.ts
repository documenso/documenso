import { sValidator } from '@hono/standard-validator';
import { Google, decodeIdToken, generateCodeVerifier, generateState } from 'arctic';
import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { env } from '@documenso/lib/utils/env';
import { prisma } from '@documenso/prisma';
import { UserSecurityAuditLogType } from '@documenso/prisma/client';

import { AuthenticationErrorCode } from '../lib/errors/error-codes';
import { sessionCookieOptions } from '../lib/session/session-cookies';
import { onAuthorize } from '../lib/utils/authorizer';
import type { HonoAuthContext } from '../types/context';

const options = {
  clientId: env('NEXT_PRIVATE_GOOGLE_CLIENT_ID') ?? '',
  clientSecret: env('NEXT_PRIVATE_GOOGLE_CLIENT_SECRET') ?? '',
  redirectUri: `${NEXT_PUBLIC_WEBAPP_URL()}/api/auth/google/callback`,
  scope: ['openid', 'email', 'profile'],
  id: 'google',
};

const google = new Google(options.clientId, options.clientSecret, options.redirectUri);

// todo: NEXT_PRIVATE_OIDC_WELL_KNOWN???

const ZGoogleAuthorizeSchema = z.object({
  redirectPath: z.string().optional(),
});

export const googleRoute = new Hono<HonoAuthContext>()
  /**
   * Authorize endpoint.
   */
  .post('/authorize', sValidator('json', ZGoogleAuthorizeSchema), (c) => {
    const scopes = options.scope;
    const state = generateState();

    const codeVerifier = generateCodeVerifier();
    const url = google.createAuthorizationURL(state, codeVerifier, scopes);

    const { redirectPath } = c.req.valid('json');

    setCookie(c, 'google_oauth_state', state, {
      ...sessionCookieOptions,
      sameSite: 'lax', // Todo
      maxAge: 60 * 10, // 10 minutes.
    });

    setCookie(c, 'google_code_verifier', codeVerifier, {
      ...sessionCookieOptions,
      sameSite: 'lax', // Todo
      maxAge: 60 * 10, // 10 minutes.
    });

    if (redirectPath) {
      setCookie(c, 'google_redirect_path', `${state}:${redirectPath}`, {
        ...sessionCookieOptions,
        sameSite: 'lax', // Todo
        maxAge: 60 * 10, // 10 minutes.
      });
    }

    return c.json({
      redirectUrl: url.toString(),
    });
  })
  /**
   * Google callback verification.
   */
  .get('/callback', async (c) => {
    const requestMeta = c.get('requestMetadata');

    const code = c.req.query('code');
    const state = c.req.query('state');

    const storedState = deleteCookie(c, 'google_oauth_state');
    const storedCodeVerifier = deleteCookie(c, 'google_code_verifier');
    const storedredirectPath = deleteCookie(c, 'google_redirect_path') ?? '';

    if (!code || !storedState || state !== storedState || !storedCodeVerifier) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Invalid or missing state',
      });
    }

    // eslint-disable-next-line prefer-const
    let [redirectState, redirectPath] = storedredirectPath.split(':');

    if (redirectState !== storedState || !redirectPath) {
      redirectPath = '/documents';
    }

    const tokens = await google.validateAuthorizationCode(code, storedCodeVerifier);
    const accessToken = tokens.accessToken();
    const accessTokenExpiresAt = tokens.accessTokenExpiresAt();
    const idToken = tokens.idToken();

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const claims = decodeIdToken(tokens.idToken()) as Record<string, unknown>;

    const googleEmail = claims.email;
    const googleEmailVerified = claims.email_verified;
    const googleName = claims.name;
    const googleSub = claims.sub;

    if (
      typeof googleEmail !== 'string' ||
      typeof googleName !== 'string' ||
      typeof googleSub !== 'string'
    ) {
      throw new AppError(AuthenticationErrorCode.InvalidRequest, {
        message: 'Invalid google claims',
      });
    }

    if (claims.email_verified !== true) {
      throw new AppError(AuthenticationErrorCode.UnverifiedEmail, {
        message: 'Account email is not verified',
      });
    }

    // Find the account if possible.
    const existingAccount = await prisma.account.findFirst({
      where: {
        provider: 'google',
        providerAccountId: googleSub,
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
        email: googleEmail,
      },
    });

    // Handle existing user but no account.
    if (userWithSameEmail) {
      await prisma.$transaction(async (tx) => {
        await tx.account.create({
          data: {
            type: 'oauth',
            provider: 'google',
            providerAccountId: googleSub,
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
              password: null, // Todo: Check this
            },
          });
        }

        // Apparently incredibly rare case? So we whole account to unverified.
        if (!googleEmailVerified) {
          // Todo: Add logging.

          await tx.user.update({
            where: {
              id: userWithSameEmail.id,
            },
            data: {
              emailVerified: null,
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
          email: googleEmail,
          name: googleName,
        },
      });

      await tx.account.create({
        data: {
          type: 'oauth',
          provider: 'google',
          providerAccountId: googleSub,
          access_token: accessToken,
          expires_at: Math.floor(accessTokenExpiresAt.getTime() / 1000),
          token_type: 'Bearer',
          id_token: idToken,
          userId: user.id,
        },
      });

      return user;
    });

    await onAuthorize({ userId: createdUser.id }, c);

    return c.redirect(redirectPath, 302);
  });
