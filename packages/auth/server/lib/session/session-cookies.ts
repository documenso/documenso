import {
  formatHostCookieName,
  formatSecureCookieName,
  getCookieDomain,
  shouldUseSecureCookies,
} from '@documenso/lib/constants/auth';
import { appLog } from '@documenso/lib/utils/debugger';
import { env } from '@documenso/lib/utils/env';
import type { Context } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import { z } from 'zod';

import { AUTH_EMBED_SESSION_LIFETIME, AUTH_SESSION_LIFETIME } from '../../config';
import { extractCookieFromHeaders } from '../utils/cookies';
import { generateSessionToken } from './session';

const sessionCookieName = formatSecureCookieName('sessionId');
const csrfCookieName = formatSecureCookieName('csrfToken');

// Both are `__Host-` prefixed: cannot be set by a subdomain and must not carry a `Domain` attribute.
const embedSessionCookieName = formatHostCookieName('embedSessionId');
const embedAuthFlowCookieName = formatHostCookieName('embed_auth_flow');

const embedAuthFlowCookieMaxAge = 60 * 10;

const embedAuthFlowMaxAgeMs = embedAuthFlowCookieMaxAge * 1000;

/**
 * `iat` lets the server expire the flow independently of the browser honouring
 * `Max-Age`. `state` doubles as the OAuth `state` and must be echoed on
 * `/complete`, so a second popup that overwrote this cookie cannot complete
 * this flow.
 */
const ZEmbedAuthFlowCookiePayloadSchema = z.object({
  nonce: z.string().uuid(),
  iat: z.number().int().positive(),
  state: z.string().min(1),
});

export type EmbedAuthFlowCookiePayload = z.infer<typeof ZEmbedAuthFlowCookiePayloadSchema>;

export const getAuthSecret = () => {
  const authSecret = env('NEXTAUTH_SECRET');

  if (!authSecret) {
    throw new Error('NEXTAUTH_SECRET is not set');
  }

  return authSecret;
};

/**
 * Generic auth session cookie options.
 */
export const sessionCookieOptions = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax', // Embeds use the partitioned embed cookie instead of relaxing this to 'none'.
  secure: shouldUseSecureCookies(),
  domain: getCookieDomain(),
} as const;

// Partitioned (CHIPS) so it can be set and read from inside a cross-site iframe.
export const embedSessionCookieOptions = {
  httpOnly: true,
  path: '/',
  sameSite: shouldUseSecureCookies() ? 'none' : 'lax',
  secure: shouldUseSecureCookies(),
  partitioned: shouldUseSecureCookies(),
} as const;

export const extractSessionCookieFromHeaders = (headers: Headers): string | null => {
  return (
    extractCookieFromHeaders(sessionCookieName, headers) ?? extractCookieFromHeaders(embedSessionCookieName, headers)
  );
};

/**
 * Get the session cookie attached to the request headers.
 *
 * @param c - The Hono context.
 * @returns The session ID or null if no session cookie is found.
 */
export const getSessionCookie = async (c: Context): Promise<string | null> => {
  const sessionId = await getSignedCookie(c, getAuthSecret(), sessionCookieName);

  if (sessionId) {
    return sessionId;
  }

  const embedSessionId = await getSignedCookie(c, getAuthSecret(), embedSessionCookieName);

  return embedSessionId || null;
};

/**
 * Set the session cookie into the Hono context.
 *
 * @param c - The Hono context.
 * @param sessionToken - The session token to set.
 */
export const setSessionCookie = async (c: Context, sessionToken: string) => {
  await setSignedCookie(c, sessionCookieName, sessionToken, getAuthSecret(), {
    ...sessionCookieOptions,
    expires: new Date(Date.now() + AUTH_SESSION_LIFETIME),
  }).catch((err) => {
    appLog('SetSessionCookie', `Error setting signed cookie: ${err}`);

    throw err;
  });
};

/**
 * Set the session cookie into the Hono context.
 *
 * @param c - The Hono context.
 * @param sessionToken - The session token to set.
 */
export const deleteSessionCookie = (c: Context) => {
  deleteCookie(c, sessionCookieName, sessionCookieOptions);
};

export const setEmbedSessionCookie = async (c: Context, sessionToken: string) => {
  await setSignedCookie(c, embedSessionCookieName, sessionToken, getAuthSecret(), {
    ...embedSessionCookieOptions,
    expires: new Date(Date.now() + AUTH_EMBED_SESSION_LIFETIME),
  }).catch((err) => {
    appLog('SetEmbedSessionCookie', `Error setting signed embed cookie: ${err}`);

    throw err;
  });
};

export const deleteEmbedSessionCookie = (c: Context) => {
  deleteCookie(c, embedSessionCookieName, embedSessionCookieOptions);
};

// `SameSite=Lax` so it survives the top-level OAuth redirect back to the app.
export const embedAuthFlowCookieOptions = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax',
  secure: shouldUseSecureCookies(),
  maxAge: embedAuthFlowCookieMaxAge,
} as const;

export const getEmbedAuthFlowCookie = async (c: Context): Promise<EmbedAuthFlowCookiePayload | null> => {
  const rawValue = await getSignedCookie(c, getAuthSecret(), embedAuthFlowCookieName);

  if (!rawValue) {
    return null;
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(rawValue);
  } catch {
    return null;
  }

  const parsed = ZEmbedAuthFlowCookiePayloadSchema.safeParse(parsedJson);

  if (!parsed.success) {
    return null;
  }

  const age = Date.now() - parsed.data.iat;

  if (age < 0 || age > embedAuthFlowMaxAgeMs) {
    return null;
  }

  return parsed.data;
};

export const setEmbedAuthFlowCookie = async (c: Context, nonce: string, state: string) => {
  const payload: EmbedAuthFlowCookiePayload = {
    nonce,
    iat: Date.now(),
    state,
  };

  await setSignedCookie(
    c,
    embedAuthFlowCookieName,
    JSON.stringify(payload),
    getAuthSecret(),
    embedAuthFlowCookieOptions,
  ).catch((err) => {
    appLog('SetEmbedAuthFlowCookie', `Error setting signed embed auth flow cookie: ${err}`);

    throw err;
  });
};

export const clearEmbedAuthFlowCookie = (c: Context) => {
  deleteCookie(c, embedAuthFlowCookieName, {
    ...embedAuthFlowCookieOptions,
    maxAge: undefined,
  });
};

export const getCsrfCookie = async (c: Context) => {
  const csrfToken = await getSignedCookie(c, getAuthSecret(), csrfCookieName);

  return csrfToken || null;
};

export const setCsrfCookie = async (c: Context) => {
  const csrfToken = generateSessionToken();

  await setSignedCookie(c, csrfCookieName, csrfToken, getAuthSecret(), {
    ...sessionCookieOptions,

    // Explicity set to undefined for session lived cookie.
    expires: undefined,
    maxAge: undefined,
  });

  return csrfToken;
};
