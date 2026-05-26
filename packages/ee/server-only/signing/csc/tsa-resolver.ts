import { NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

import { joinCscUrl } from './client/http';
import type { CscTransport } from './transport';

/**
 * Resolve the time-stamping authority used by the B-LTA seal step.
 *
 * Two sources, in precedence order:
 *
 * 1. The instance-wide `NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY` env var
 *    (comma-separated RFC 3161 URLs; shared with the existing SES seal flow).
 *    Wins when set so operators have an explicit escape hatch — V1 can speak
 *    RFC 3161 via libpdf's `HttpTimestampAuthority` directly, but the CSC
 *    §11.10 wire format requires a service-scope bearer that isn't bound
 *    to a single recipient at seal time. Until §11.10 wrapping ships, the
 *    env path is the only one we can drive.
 * 2. The TSP itself, when `info.methods` advertises `signatures/timestamp`
 *    (CSC §11.10). Reserved for V2; today the seal-time wrapper rejects
 *    this branch with `NOT_SETUP` pointing the operator at the env var.
 *
 * Throws `CSC_PROVIDER_NO_TSA` when neither is configured. Sync — the caller
 * has already resolved the transport via {@link getCscTransport}.
 */

export type CscTsaConfig = {
  /**
   * Wire protocol selector for `urls[i]`:
   * - `tsp` — CSC §11.10 JSON POST with the recipient's service-scope bearer.
   * - `env` — RFC 3161 DER TSQ over `application/timestamp-query`.
   */
  source: 'tsp' | 'env';
  /**
   * TSA endpoint URLs in declared order. Single entry for `tsp` (the joined
   * `signatures/timestamp` URL); the operator-supplied list for `env`.
   * Consumer iterates with whatever fallback policy it wants — typically
   * `const [primary, ...fallbacks] = urls`.
   */
  urls: string[];
};

export const resolveCscTsa = (transport: CscTransport): CscTsaConfig => {
  const envUrls = parseTsaEnv(NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY());

  if (envUrls.length > 0) {
    return { source: 'env', urls: envUrls };
  }

  if (transport.supportsTimestamp) {
    return {
      source: 'tsp',
      urls: [joinCscUrl({ baseUrl: transport.serviceBaseUrl, path: 'signatures/timestamp' })],
    };
  }

  throw new AppError(AppErrorCode.CSC_PROVIDER_NO_TSA, {
    message:
      'NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY is unset and the CSC TSP does not advertise `signatures/timestamp`. Configure at least one RFC 3161 TSA URL.',
  });
};

const parseTsaEnv = (raw: string | undefined): string[] => {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
};
