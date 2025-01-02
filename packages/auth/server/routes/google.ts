import { Google, decodeIdToken, generateCodeVerifier, generateState } from 'arctic';
import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { setupTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/setup-2fa';
import { prisma } from '@documenso/prisma';

import { AuthenticationErrorCode } from '../lib/errors/error-codes';
import { onAuthorize } from '../lib/utils/authorizer';
import { getRequiredSession } from '../lib/utils/get-session';
import type { HonoAuthContext } from '../types/context';

const options = {
  clientId: import.meta.env.NEXT_PRIVATE_GOOGLE_CLIENT_ID,
  clientSecret: import.meta.env.NEXT_PRIVATE_GOOGLE_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/api/auth/google/callback',
  scope: ['openid', 'email', 'profile'],
  id: 'google',
};

const google = new Google(options.clientId, options.clientSecret, options.redirectUri);

// todo: NEXT_PRIVATE_OIDC_WELL_KNOWN???

export const googleRoute = new Hono<HonoAuthContext>()
  /**
   * Authorize endpoint.
   */
  .post('/authorize', (c) => {
    const scopes = options.scope;
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = google.createAuthorizationURL(state, codeVerifier, scopes);

    setCookie(c, 'google_oauth_state', state, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 10, // 10 minutes
      sameSite: 'lax',
    });

    setCookie(c, 'google_code_verifier', codeVerifier, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 10, // 10 minutes
      sameSite: 'lax',
    });

    // return new Response(null, {
    //   status: 302,
    //   headers: {
    //     Location: url.toString()
    //   }
    // });

    return c.json({
      redirectUrl: url,
    });
  })
  /**
   * Google callback verification.
   */
  .get('/callback', async (c) => {
    // Todo: Use ZValidator to validate query params.

    const code = c.req.query('code');
    const state = c.req.query('state');

    const storedState = getCookie(c, 'google_oauth_state');
    const storedCodeVerifier = getCookie(c, 'google_code_verifier');

    if (!code || !storedState || state !== storedState || !storedCodeVerifier) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Invalid or missing state',
      });
    }

    const tokens = await google.validateAuthorizationCode(code, storedCodeVerifier);
    const accessToken = tokens.accessToken();
    const accessTokenExpiresAt = tokens.accessTokenExpiresAt();
    const idToken = tokens.idToken();

    console.log(tokens);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const claims = decodeIdToken(tokens.idToken()) as Record<string, unknown>;

    console.log(claims);

    const googleEmail = claims.email;
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

      return c.redirect('/documents', 302); // Todo: Redirect
    }

    const userWithSameEmail = await prisma.user.findFirst({
      where: {
        email: googleEmail,
      },
    });

    // Handle existing user but no account.
    if (userWithSameEmail) {
      await prisma.account.create({
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

      // Todo: Link account
      await onAuthorize({ userId: userWithSameEmail.id }, c);

      return c.redirect('/documents', 302); // Todo: Redirect
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

    return c.redirect('/documents', 302); // Todo: Redirect
  })
  /**
   * Setup passkey authentication.
   */
  .post('/setup', async (c) => {
    const { user } = await getRequiredSession(c);

    const result = await setupTwoFactorAuthentication({
      user,
    });

    return c.json({
      success: true,
      secret: result.secret,
      uri: result.uri,
    });
  });
