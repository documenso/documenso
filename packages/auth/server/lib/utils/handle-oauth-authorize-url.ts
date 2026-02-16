import { CodeChallengeMethod, OAuth2Client, generateCodeVerifier, generateState } from 'arctic';
import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

import type { OAuthClientOptions } from '../../config';
import { sessionCookieOptions } from '../session/session-cookies';
import { getOpenIdConfiguration } from './open-id';

type HandleOAuthAuthorizeUrlOptions = {
  /**
   * Hono context.
   */
  c: Context;

  /**
   * OAuth client options.
   */
  clientOptions: OAuthClientOptions;

  /**
   * Optional redirect path to redirect the user somewhere on the app after authorization.
   */
  redirectPath?: string;

  /**
   * Optional prompt to pass to the authorization endpoint.
   */
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
};

const isOidcPrompt = (value: unknown): value is HandleOAuthAuthorizeUrlOptions['prompt'] => {
  return value === 'none' || value === 'login' || value === 'consent' || value === 'select_account';
};

const oauthCookieMaxAge = 60 * 10; // 10 minutes.

export const handleOAuthAuthorizeUrl = async (options: HandleOAuthAuthorizeUrlOptions) => {
  const { c, clientOptions, redirectPath } = options;

  let prompt = options.prompt ?? 'login';

  if (!clientOptions.clientId || !clientOptions.clientSecret) {
    throw new AppError(AppErrorCode.NOT_SETUP);
  }

  const { authorization_endpoint } = await getOpenIdConfiguration(clientOptions.wellKnownUrl, {
    requiredScopes: clientOptions.scope,
  });

  const oAuthClient = new OAuth2Client(
    clientOptions.clientId,
    clientOptions.clientSecret,
    clientOptions.redirectUrl,
  );

  const scopes = clientOptions.scope;
  const state = generateState();

  const codeVerifier = generateCodeVerifier();

  const url = oAuthClient.createAuthorizationURLWithPKCE(
    authorization_endpoint,
    state,
    CodeChallengeMethod.S256,
    codeVerifier,
    scopes,
  );

  // Pass the prompt to the authorization endpoint.
  if (process.env.NEXT_PRIVATE_OIDC_PROMPT && isOidcPrompt(process.env.NEXT_PRIVATE_OIDC_PROMPT)) {
    prompt = process.env.NEXT_PRIVATE_OIDC_PROMPT;
  }

  url.searchParams.set('prompt', prompt);

  setCookie(c, `${clientOptions.id}_oauth_state`, state, {
    ...sessionCookieOptions,
    sameSite: 'lax',
    maxAge: oauthCookieMaxAge,
  });

  setCookie(c, `${clientOptions.id}_code_verifier`, codeVerifier, {
    ...sessionCookieOptions,
    sameSite: 'lax',
    maxAge: oauthCookieMaxAge,
  });

  if (redirectPath) {
    setCookie(c, `${clientOptions.id}_redirect_path`, `${state} ${redirectPath}`, {
      ...sessionCookieOptions,
      sameSite: 'lax',
      maxAge: oauthCookieMaxAge,
    });
  }

  return c.json({
    redirectUrl: url.toString(),
  });
};
