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
 * Returns true (session valid) if:
 * - User has no OAuth accounts (email/password user)
 * - Token is expired (natural expiry is NOT revocation — fail-open)
 * - Provider confirms the token is still valid (200)
 * - Check was performed recently and cached as valid
 * - Provider is unreachable (fail-open)
 *
 * Returns false (session killed) only if:
 * - Provider explicitly rejects the token (401/403 = revoked)
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
      expires_at: true,
    },
  });

  // No OAuth accounts — user signed in via email/password. Always valid.
  if (accounts.length === 0) {
    oauthStatusCache.set(userId, { lastChecked: Date.now(), valid: true });
    return true;
  }

  for (const account of accounts) {
    // If token has expired, we cannot introspect it — the provider will reject it
    // for being expired, not necessarily revoked. Token expiry is natural and does
    // NOT indicate revocation. Fail-open.
    if (account.expires_at) {
      const expiresAtMs = account.expires_at * 1000;

      if (Date.now() > expiresAtMs) {
        // Expired token — skip introspection, fail-open.
        // The user will get a fresh token on their next OAuth login.
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
const introspectOAuthToken = async (
  provider: string,
  accessToken: string | null,
): Promise<boolean> => {
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
 * Clear the OAuth status cache for a user.
 * Call this when a user explicitly signs out or when sessions are invalidated.
 */
export const clearOAuthCache = (userId: number): void => {
  oauthStatusCache.delete(userId);
};
