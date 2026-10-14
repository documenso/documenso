import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { CodeChallengeMethod, generateCodeVerifier, generateState, OAuth2Client } from 'arctic';
import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';

import type { OAuthClientOptions } from '../../config';
import { sessionCookieOptions } from '../session/session-cookies';
import { getOpenIdConfiguration } from './open-id';

export type HandleOAuthAuthorizeUrlOptions = {
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

export type ResolvePromptOptions = {
  provider: string;
  prompt?: HandleOAuthAuthorizeUrlOptions['prompt'];
};

export const isOidcPrompt = (value: unknown): value is NonNullable<HandleOAuthAuthorizeUrlOptions['prompt']> => {
  return value === 'none' || value === 'login' || value === 'consent' || value === 'select_account';
};

export type ResolvePromptFn = {
  (options: ResolvePromptOptions): HandleOAuthAuthorizeUrlOptions['prompt'] | undefined;
  (
    provider: string,
    prompt?: HandleOAuthAuthorizeUrlOptions['prompt'],
  ): HandleOAuthAuthorizeUrlOptions['prompt'] | undefined;
};

export const resolvePrompt: ResolvePromptFn = (
  providerOrOptions: string | ResolvePromptOptions,
  prompt?: HandleOAuthAuthorizeUrlOptions['prompt'],
): HandleOAuthAuthorizeUrlOptions['prompt'] | undefined => {
  const provider = typeof providerOrOptions === 'string' ? providerOrOptions : providerOrOptions.provider;
  const routePrompt = typeof providerOrOptions === 'string' ? prompt : providerOrOptions.prompt;

  if (provider === 'oidc') {
    const envPrompt = process.env.NEXT_PRIVATE_OIDC_PROMPT;

    if (envPrompt === '') {
      return undefined;
    }

    if (envPrompt !== undefined) {
      if (isOidcPrompt(envPrompt)) {
        return envPrompt;
      }

      return routePrompt ?? 'login';
    }
  }

  return routePrompt ?? 'login';
};

const oauthCookieMaxAge = 60 * 10; // 10 minutes.

export const handleOAuthAuthorizeUrl = async (options: HandleOAuthAuthorizeUrlOptions) => {
  const { c, clientOptions, redirectPath } = options;

  if (!clientOptions.clientId || !clientOptions.clientSecret) {
    throw new AppError(AppErrorCode.NOT_SETUP);
  }

  const { authorization_endpoint } = await getOpenIdConfiguration(clientOptions.wellKnownUrl, {
    requiredScopes: clientOptions.scope,
  });

  const oAuthClient = new OAuth2Client(clientOptions.clientId, clientOptions.clientSecret, clientOptions.redirectUrl);

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

  const prompt = resolvePrompt({
    provider: clientOptions.id,
    prompt: options.prompt,
  });

  if (prompt !== undefined) {
    url.searchParams.set('prompt', prompt);
  }

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
