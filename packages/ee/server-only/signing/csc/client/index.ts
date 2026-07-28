/**
 * CSC v1.0.4.0 HTTP client. Stateless function wrappers — one per endpoint,
 * grouped by spec section. Bring your own base URL(s) and bearer token.
 *
 * Endpoint coverage (V1 scope):
 * - §11.1  info                       → {@link cscInfo}
 * - §11.4  credentials/list           → {@link cscCredentialsList}
 * - §11.5  credentials/info           → {@link cscCredentialsInfo}
 * - §11.9  signatures/signHash        → {@link cscSignHash}
 * - §11.10 signatures/timestamp       → {@link cscTimestamp}
 * - §8.3.2 oauth2/authorize           → {@link buildCscServiceScopeAuthorizeUrl},
 *                                        {@link buildCscCredentialScopeAuthorizeUrl}
 * - §8.3.3 oauth2/token               → {@link exchangeCscAuthorizationCode},
 *                                        {@link refreshCscServiceToken}
 * - §8.3.4 oauth2/revoke              → {@link revokeCscToken}
 *
 * Out of scope for V1 (intentionally excluded; we use OAuth + single-sig):
 * - §11.2 auth/login                  (HTTP Basic)
 * - §11.3 auth/revoke                 (HTTP Basic)
 * - §11.6 credentials/authorize       (alternative to OAuth credential scope)
 * - §11.7 credentials/extendTransaction
 * - §11.8 credentials/sendOTP
 *
 * OAuth is delegated to `arctic` (same library `packages/auth/` uses).
 */

export * from './credentials';
export * from './http';
export * from './info';
export * from './oauth';
export * from './signatures';
export * from './types';
