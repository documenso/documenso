import { AppError, AppErrorCode } from '../../errors/app-error';

export type ExchangeAuthorizationCodeOptions = {
  tokenEndpoint: string;
  redirectUrl: string;
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
};

export type ExchangeAuthorizationCodeResult = {
  accessToken: string;
  accessTokenExpiresAt: Date;
  idToken: string;
};

type TokenResponseBody = {
  access_token?: unknown;
  expires_in?: unknown;
  id_token?: unknown;
  error?: unknown;
  error_description?: unknown;
};

const formUrlEncode = (value: string) => new URLSearchParams([['value', value]]).toString().slice('value='.length);

/**
 * Builds the HTTP Basic header for `client_secret_basic`, form-encoding each
 * credential as required by RFC 6749 §2.3.1.
 *
 * Without the encoding a Basic auth server splits the decoded credential at the
 * first colon: `org:example:documenso:secret` is read as username `org` with
 * password `example:documenso:secret`, which providers reject as
 * `invalid_client`.
 */
export const buildClientAuthenticationHeader = (clientId: string, clientSecret: string) => {
  const credentials = `${formUrlEncode(clientId)}:${formUrlEncode(clientSecret)}`;

  return `Basic ${Buffer.from(credentials, 'utf8').toString('base64')}`;
};

/**
 * Exchanges an OIDC authorization code for tokens using `client_secret_basic`.
 *
 * This replaces `OAuth2Client.validateAuthorizationCode` from `arctic`, which
 * base64-encodes the raw client ID and secret instead of form-encoding them.
 */
export const exchangeAuthorizationCode = async ({
  tokenEndpoint,
  redirectUrl,
  clientId,
  clientSecret,
  code,
  codeVerifier,
}: ExchangeAuthorizationCodeOptions): Promise<ExchangeAuthorizationCodeResult> => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUrl,
    code_verifier: codeVerifier,
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: buildClientAuthenticationHeader(clientId, clientSecret),
    },
    body: body.toString(),
  });

  const data = (await response.json().catch(() => null)) as TokenResponseBody | null;

  if (!response.ok) {
    const error = typeof data?.error === 'string' ? data.error : `HTTP ${response.status}`;
    const description = typeof data?.error_description === 'string' ? `: ${data.error_description}` : '';

    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: `OAuth token exchange failed (${error})${description}`,
      statusCode: response.status,
    });
  }

  const accessToken = data?.access_token;
  const expiresIn = data?.expires_in;
  const idToken = data?.id_token;

  if (typeof accessToken !== 'string') {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: "OAuth token response is missing a valid 'access_token' field",
    });
  }

  if (typeof expiresIn !== 'number') {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: "OAuth token response is missing a valid 'expires_in' field",
    });
  }

  if (typeof idToken !== 'string') {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: "OAuth token response is missing a valid 'id_token' field",
    });
  }

  return {
    accessToken,
    accessTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
    idToken,
  };
};
