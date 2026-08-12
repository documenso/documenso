import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  ArcticFetchError,
  CodeChallengeMethod,
  generateCodeVerifier,
  generateState,
  OAuth2Client,
  OAuth2RequestError,
  type OAuth2Tokens,
  UnexpectedErrorResponseBodyError,
  UnexpectedResponseError,
} from 'arctic';

import { joinCscUrl } from './http';

/**
 * OAuth 2.0 surface for the CSC v1.0.4.0 protocol (§8.3.2 authorize,
 * §8.3.3 token, §8.3.4 revoke).
 *
 * Backed by `arctic` — the same library `packages/auth/` uses for sign-in
 * OAuth — so PKCE + state generation, token parsing, and revocation share a
 * proven implementation. CSC-specific extension parameters (`credentialID`,
 * `numSignatures`, `hash`, `description`, `account_token`, `clientData`,
 * `lang` — §8.3.2) layer on top of the returned `URL` via
 * `searchParams.set()`.
 *
 * Non-standard CSC bits arctic doesn't model directly:
 * - `token_type === 'SAD'` for credential-scope responses (§8.3.3). Read from
 *   `tokens.tokenType()` which sources from raw `data`.
 * - SAD is single-use and short-lived per spec; no refresh_token is issued
 *   for the credential scope. Callers SHOULD NOT call `refreshAccessToken`
 *   with a SAD.
 *
 * Re-exports `generateState` and `generateCodeVerifier` for callers that
 * persist these in the OAuth-flow cookie.
 */

export { generateCodeVerifier, generateState };

// ─── Client construction ─────────────────────────────────────────────────────

type CreateCscOAuthClientOptions = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/**
 * Construct an `OAuth2Client` bound to the CSC TSP's OAuth registration. The
 * three values come from the env (`NEXT_PRIVATE_SIGNING_CSC_OAUTH_*`).
 * Stateless — instantiate per request or cache at the transport singleton
 * level; arctic's client carries no per-call state.
 */
export const createCscOAuthClient = ({
  clientId,
  clientSecret,
  redirectUri,
}: CreateCscOAuthClientOptions): OAuth2Client => {
  return new OAuth2Client(clientId, clientSecret, redirectUri);
};

// ─── Authorize URL builders (§8.3.2) ─────────────────────────────────────────

type AuthorizeUrlBaseOptions = {
  client: OAuth2Client;
  /**
   * The TSP's OAuth base URI as returned by `info.oauth2` (§11.1). The
   * `oauth2/authorize` path is joined on; per §8.3.2 NOTE 1 this can live on
   * a different host from the API base URI.
   */
  oauthBaseUrl: string;
  /** Opaque CSRF token; see {@link generateState}. Caller persists it. */
  state: string;
  /** PKCE verifier; see {@link generateCodeVerifier}. Caller persists it. */
  codeVerifier: string;
  /** Preferred response language (§11.1 `lang` parameter). */
  lang?: string;
  /**
   * Arbitrary application-defined string echoed back at callback. WARNING per
   * §8.3.2: this is forwarded verbatim to the TSP; never put secrets here.
   */
  clientData?: string;
};

const applyCscAuthorizeExtras = (url: URL, opts: { lang?: string; clientData?: string }): URL => {
  if (opts.lang) {
    url.searchParams.set('lang', opts.lang);
  }

  if (opts.clientData) {
    url.searchParams.set('clientData', opts.clientData);
  }

  return url;
};

/**
 * Build the `oauth2/authorize` URL for the **service** scope. Recipient
 * follows this URL to authenticate at the TSP and grant access to list
 * credentials + fetch credential info.
 */
export const buildCscServiceScopeAuthorizeUrl = (opts: AuthorizeUrlBaseOptions): URL => {
  const { client, oauthBaseUrl, state, codeVerifier, lang, clientData } = opts;

  const url = client.createAuthorizationURLWithPKCE(
    joinCscUrl({ baseUrl: oauthBaseUrl, path: 'oauth2/authorize' }),
    state,
    CodeChallengeMethod.S256,
    codeVerifier,
    ['service'],
  );

  return applyCscAuthorizeExtras(url, { lang, clientData });
};

type CredentialScopeAuthorizeOptions = AuthorizeUrlBaseOptions & {
  /** Target credential (§8.3.2 — REQUIRED for credential scope). */
  credentialId: string;
  /** Number of signatures this SAD will authorise (§8.3.2 — REQUIRED). */
  numSignatures: number;
  /**
   * Standard-base64-encoded hash values the SAD will be bound to. REQUIRED for
   * SCAL2 credentials (§8.3.2). The builder converts each value to base64url
   * before joining with `,` per the spec — §8.3.2 mandates base64url for the
   * `hash` URL parameter, but the rest of the codebase (and the
   * `signatures/signHash` JSON body per §11.9) uses standard base64. Callers
   * pass what `Buffer.from(...).toString('base64')` produces.
   */
  hashes: string[];
  /** Human-readable transaction description shown on the TSP's SCA page. */
  description?: string;
  /** Optional restricted-access token (JWT) some TSPs require (§8.3.2). */
  accountToken?: string;
};

/**
 * Convert a standard-base64 string to base64url (RFC 4648 §5). The CSC §8.3.2
 * `hash` URL parameter requires base64url; TSPs reject standard base64 even
 * after percent-decoding because `+`, `/`, and `=` are invalid base64url
 * characters. JSON-body fields (§11.9 `signatures/signHash`) keep standard
 * base64.
 */
const toBase64Url = (standardBase64: string): string =>
  standardBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Build the `oauth2/authorize` URL for the **credential** scope. The TSP
 * binds the issued SAD to `hashes` so it can only sign those exact digests.
 *
 * Hash ordering in the SAD is independent of the order passed to
 * `signatures/signHash` (§8.3.2) — the TSP matches by hash value, not
 * position.
 */
export const buildCscCredentialScopeAuthorizeUrl = (opts: CredentialScopeAuthorizeOptions): URL => {
  const {
    client,
    oauthBaseUrl,
    state,
    codeVerifier,
    credentialId,
    numSignatures,
    hashes,
    description,
    accountToken,
    lang,
    clientData,
  } = opts;

  const url = client.createAuthorizationURLWithPKCE(
    joinCscUrl({ baseUrl: oauthBaseUrl, path: 'oauth2/authorize' }),
    state,
    CodeChallengeMethod.S256,
    codeVerifier,
    ['credential'],
  );

  url.searchParams.set('credentialID', credentialId);
  url.searchParams.set('numSignatures', String(numSignatures));
  url.searchParams.set('hash', hashes.map(toBase64Url).join(','));

  if (description) {
    url.searchParams.set('description', description);
  }

  if (accountToken) {
    url.searchParams.set('account_token', accountToken);
  }

  return applyCscAuthorizeExtras(url, { lang, clientData });
};

// ─── Token exchange (§8.3.3) ─────────────────────────────────────────────────

type ExchangeCodeOptions = {
  client: OAuth2Client;
  /** OAuth base URI from `info.oauth2`. `oauth2/token` is joined on. */
  oauthBaseUrl: string;
  /** Authorization code from the callback's `code` query param. */
  code: string;
  /** Same PKCE verifier passed to the authorize URL builder. */
  codeVerifier: string;
  signal?: AbortSignal;
};

/**
 * Exchange an authorization code for an access token. Used for both scopes;
 * the response shape differs only in `token_type`:
 *
 * - service scope: `token_type === 'Bearer'`, optional `refresh_token`.
 * - credential scope: `token_type === 'SAD'`, single-use, no refresh_token.
 *
 * Inspect `tokens.tokenType()` (or `tokens.data` for raw access) to
 * discriminate.
 */
export const exchangeCscAuthorizationCode = async (opts: ExchangeCodeOptions): Promise<OAuth2Tokens> => {
  const { client, oauthBaseUrl, code, codeVerifier } = opts;

  try {
    return await client.validateAuthorizationCode(
      joinCscUrl({ baseUrl: oauthBaseUrl, path: 'oauth2/token' }),
      code,
      codeVerifier,
    );
  } catch (err) {
    throw mapArcticError(err, 'oauth2/token');
  }
};

type RefreshServiceTokenOptions = {
  client: OAuth2Client;
  oauthBaseUrl: string;
  /** Service-scope refresh token from a prior token exchange. */
  refreshToken: string;
  signal?: AbortSignal;
};

/**
 * Refresh a service-scope access token. Credential-scope SADs are NOT
 * refreshable per §8.3.3 — only service scope issues refresh tokens.
 *
 * Scopes passed as `['service']` to keep the refresh narrow; the TSP may
 * ignore the scope parameter on refresh per RFC 6749 §6.
 */
export const refreshCscServiceToken = async (opts: RefreshServiceTokenOptions): Promise<OAuth2Tokens> => {
  const { client, oauthBaseUrl, refreshToken } = opts;

  try {
    return await client.refreshAccessToken(joinCscUrl({ baseUrl: oauthBaseUrl, path: 'oauth2/token' }), refreshToken, [
      'service',
    ]);
  } catch (err) {
    throw mapArcticError(err, 'oauth2/token');
  }
};

// ─── Revoke (§8.3.4) ─────────────────────────────────────────────────────────

type RevokeTokenOptions = {
  client: OAuth2Client;
  oauthBaseUrl: string;
  /** Access token or refresh token to revoke. */
  token: string;
  signal?: AbortSignal;
};

/**
 * Revoke a CSC OAuth token. Per §8.3.4, revoking a refresh token also
 * invalidates every access token derived from the same grant; revoking an
 * access token only invalidates that access token.
 *
 * `204 No Content` on success; arctic resolves the promise. Failures
 * surface as `CSC_REQUEST_FAILED` via {@link mapArcticError}.
 */
export const revokeCscToken = async (opts: RevokeTokenOptions): Promise<void> => {
  const { client, oauthBaseUrl, token } = opts;

  try {
    await client.revokeToken(joinCscUrl({ baseUrl: oauthBaseUrl, path: 'oauth2/revoke' }), token);
  } catch (err) {
    throw mapArcticError(err, 'oauth2/revoke');
  }
};

// ─── Error normalisation ────────────────────────────────────────────────────

/**
 * Translate arctic's typed exception hierarchy into AppErrors consistent with
 * the rest of the CSC client (see http.ts). Preserves the HTTP status when
 * arctic surfaces it.
 */
const mapArcticError = (err: unknown, endpoint: string): AppError => {
  if (err instanceof OAuth2RequestError) {
    return new AppError(AppErrorCode.CSC_REQUEST_FAILED, {
      message: `CSC ${endpoint} rejected: ${err.code}${err.description ? ` — ${err.description}` : ''}`,
    });
  }

  if (err instanceof ArcticFetchError) {
    return new AppError(AppErrorCode.CSC_REQUEST_FAILED, {
      message: `CSC ${endpoint} fetch failed: ${err.message}`,
    });
  }

  if (err instanceof UnexpectedResponseError) {
    return new AppError(AppErrorCode.CSC_REQUEST_FAILED, {
      message: `CSC ${endpoint} returned unexpected HTTP ${err.status}`,
      statusCode: err.status,
    });
  }

  if (err instanceof UnexpectedErrorResponseBodyError) {
    return new AppError(AppErrorCode.CSC_REQUEST_FAILED, {
      message: `CSC ${endpoint} returned HTTP ${err.status} with unparseable body`,
      statusCode: err.status,
    });
  }

  return new AppError(AppErrorCode.CSC_REQUEST_FAILED, {
    message: `CSC ${endpoint} failed: ${err instanceof Error ? err.message : String(err)}`,
  });
};
