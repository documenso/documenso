import { prisma } from '@documenso/prisma';

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
 * Returns true if:
 * - User has no OAuth accounts (email/password user)
 * - OAuth token has not expired
 * - OAuth provider confirms the token is still valid
 * - Check was performed recently and cached as valid
 *
 * Returns false if:
 * - OAuth token is expired and no refresh token exists
 * - OAuth provider rejects the token (revoked)
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
    // If token has an expiry and it's in the past
    if (account.expires_at) {
      const expiresAtMs = account.expires_at * 1000;

      if (Date.now() > expiresAtMs) {
        // Token expired — if no refresh token, the grant is effectively revoked
        if (!account.refresh_token) {
          oauthStatusCache.set(userId, { lastChecked: Date.now(), valid: false });
          return false;
        }

        // Has refresh token — attempt to validate with provider
        const isValid = await introspectOAuthToken(account.provider, account.access_token);
        if (!isValid) {
          oauthStatusCache.set(userId, { lastChecked: Date.now(), valid: false });
          return false;
        }
      }
    }

    // Token not expired — validate with provider if we haven't checked recently
    if (account.access_token) {
      const isValid = await introspectOAuthToken(account.provider, account.access_token);
      oauthStatusCache.set(userId, { lastChecked: Date.now(), valid: isValid });
      return isValid;
    }
  }

  // Default: valid (fail-open to avoid locking out users on provider downtime)
  oauthStatusCache.set(userId, { lastChecked: Date.now(), valid: true });
  return true;
};

/**
 * Check with the OAuth provider whether a token is still valid.
 *
 * For Google: uses the tokeninfo endpoint.
 * For other providers: checks the userinfo endpoint (standard OIDC).
 *
 * Returns false if the provider rejects the token (revoked/expired).
 * Returns true if the provider confirms it or if the check fails (fail-open).
 */
const introspectOAuthToken = async (
  provider: string,
  accessToken: string | null,
): Promise<boolean> => {
  if (!accessToken) {
    return false;
  }

  try {
    let introspectUrl: string;

    switch (provider) {
      case 'google':
        introspectUrl = `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`;
        break;
      case 'microsoft':
        introspectUrl = 'https://graph.microsoft.com/v1.0/me';
        break;
      default:
        // For unknown providers, skip introspection (fail-open)
        return true;
    }

    const response = await fetch(introspectUrl, {
      method: provider === 'google' ? 'GET' : 'GET',
      headers:
        provider !== 'google'
          ? { Authorization: `Bearer ${accessToken}` }
          : {},
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401 || response.status === 403) {
      // Token has been revoked or is invalid
      return false;
    }

    if (response.status === 400) {
      // Google returns 400 for invalid/expired tokens
      const body = await response.json().catch(() => null);
      if (body && body.error === 'invalid_token') {
        return false;
      }
    }

    // 200 = token is valid
    if (response.ok) {
      return true;
    }

    // On unexpected errors, fail-open to avoid locking users out
    return true;
  } catch {
    // Network error, timeout, etc. — fail-open
    return true;
  }
};

/**
 * Clear the OAuth status cache for a user.
 * Call this when a user explicitly signs out or when sessions are invalidated.
 */
export const clearOAuthCache = (userId: number): void => {
  oauthStatusCache.delete(userId);
};
