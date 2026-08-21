import { prisma } from '@documenso/prisma';
import { GoogleAuthOptions, MicrosoftAuthOptions } from '../../config';

/**
 * How often to re-validate OAuth grants (in milliseconds).
 * Checking on every request would rate-limit against OAuth providers.
 */
const OAUTH_CHECK_INTERVAL_MS = 1000 * 60 * 10; // 10 minutes

/**
 * In-memory cache to avoid checking OAuth status on every request.
 * Key: userId, Value: { lastChecked: timestamp, valid: boolean }
 */
const oauthStatusCache = new Map<number, { lastChecked: number; valid: boolean }>();

/**
 * Validate that a user's OAuth grant is still active.
 *
 * Returns true (session valid) if:
 * - User has no OAuth accounts (email/password user)
 * - Token is expired but silent refresh succeeds or fails open (fail-open)
 * - Provider confirms the token is still valid (200)
 * - Check was performed recently and cached as valid
 * - Provider is unreachable or returns a transient error (fail-open)
 *
 * Returns false (session killed) only if:
 * - Provider explicitly rejects the active token (401/403 = revoked)
 * - Provider explicitly rejects the refresh token during token exchange (400/401 with invalid_grant = revoked)
 */
export const validateOAuthGrant = async (userId: number): Promise<boolean> => {
  // Check cache first
  const cached = oauthStatusCache.get(userId);
  if (cached && Date.now() - cached.lastChecked < OAUTH_CHECK_INTERVAL_MS) {
    return cached.valid;
  }

  // Find OAuth accounts for this user
  const accounts = await prisma.account.findMany({
    where: {
      userId,
      type: 'oauth',
    },
    select: {
      provider: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  });

  // No OAuth accounts — user signed in via email/password. Always valid.
  if (accounts.length === 0) {
    oauthStatusCache.set(userId, { lastChecked: Date.now(), valid: true });
    return true;
  }

  for (const account of accounts) {
    // If token has expired, we cannot introspect it directly.
    if (account.expires_at) {
      const expiresAtMs = account.expires_at * 1000;

      if (Date.now() > expiresAtMs) {
        // Access token is expired. If we have a refresh token, we perform background refresh token exchange.
        if (account.refresh_token) {
          const refreshResult = await refreshOAuthToken(userId, account.provider, account.refresh_token);

          if (refreshResult === 'revoked') {
            oauthStatusCache.set(userId, { lastChecked: Date.now(), valid: false });
            return false;
          }

          // If refreshResult is 'valid' or 'fail-open', we continue (valid).
          continue;
        }

        // Access token expired and no refresh token available — fail-open.
        continue;
      }
    }

    // Token is still within its validity window — check with provider
    if (account.access_token) {
      const isValid = await introspectOAuthToken(account.provider, account.access_token);

      if (!isValid) {
        // Provider explicitly rejected the token — this is a real revocation
        oauthStatusCache.set(userId, { lastChecked: Date.now(), valid: false });
        return false;
      }
    }
  }

  // All accounts checked — no revocations detected
  oauthStatusCache.set(userId, { lastChecked: Date.now(), valid: true });
  return true;
};

/**
 * Check with the OAuth provider whether a token is still valid.
 *
 * For Google: uses the tokeninfo endpoint.
 * For Microsoft: checks the Graph /me endpoint.
 * For other providers: skip introspection (fail-open).
 *
 * Returns false ONLY if the provider explicitly rejects the token (401/403).
 * Returns true for all other cases (200, network error, timeout, unknown provider).
 */
const introspectOAuthToken = async (provider: string, accessToken: string | null): Promise<boolean> => {
  if (!accessToken) {
    // No token stored — cannot introspect, fail-open
    return true;
  }

  try {
    let introspectUrl: string;
    const headers: Record<string, string> = {};

    switch (provider) {
      case 'google':
        introspectUrl = `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(accessToken)}`;
        break;
      case 'microsoft':
        introspectUrl = 'https://graph.microsoft.com/v1.0/me';
        headers['Authorization'] = `Bearer ${accessToken}`;
        break;
      default:
        // Unknown provider — skip introspection (fail-open)
        return true;
    }

    const response = await fetch(introspectUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000),
    });

    // 401/403 = token has been explicitly revoked or is invalid
    if (response.status === 401 || response.status === 403) {
      return false;
    }

    // Google returns 400 for invalid/expired tokens with specific error
    if (response.status === 400 && provider === 'google') {
      const body = await response.json().catch(() => null);
      if (body && body.error === 'invalid_token') {
        return false;
      }
    }

    // 200 = token is valid. Any other status = fail-open.
    return true;
  } catch {
    // Network error, timeout, etc. — fail-open
    return true;
  }
};

/**
 * Perform background silent refresh token rotation to verify OAuth grant status.
 *
 * Returns 'revoked' if the provider explicitly rejects the refresh token.
 * Returns 'valid' if the refresh succeeds and database is updated.
 * Returns 'fail-open' for network errors or transient issues.
 */
const refreshOAuthToken = async (
  userId: number,
  provider: string,
  refreshToken: string,
): Promise<'revoked' | 'valid' | 'fail-open'> => {
  try {
    let tokenUrl: string;
    let clientId: string;
    let clientSecret: string;

    switch (provider) {
      case 'google':
        tokenUrl = 'https://oauth2.googleapis.com/token';
        clientId = GoogleAuthOptions.clientId;
        clientSecret = GoogleAuthOptions.clientSecret;
        break;
      case 'microsoft':
        tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
        clientId = MicrosoftAuthOptions.clientId;
        clientSecret = MicrosoftAuthOptions.clientSecret;
        break;
      default:
        return 'fail-open';
    }

    if (!clientId || !clientSecret) {
      return 'fail-open';
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 400 || response.status === 401) {
      // Refresh token rejected (revoked grant or expired/invalid refresh token)
      return 'revoked';
    }

    if (response.ok) {
      const body = await response.json();
      const newAccessToken = body.access_token;
      const newExpiresAt = Math.floor(Date.now() / 1000) + (body.expires_in ?? 3600);

      await prisma.account.updateMany({
        where: {
          userId,
          provider,
        },
        data: {
          access_token: newAccessToken,
          expires_at: newExpiresAt,
        },
      });

      return 'valid';
    }

    return 'fail-open';
  } catch {
    return 'fail-open';
  }
};

/**
 * Clear the OAuth status cache for a user.
 * Call this when a user explicitly signs out or when sessions are invalidated.
 */
export const clearOAuthCache = (userId: number): void => {
  oauthStatusCache.delete(userId);
};
