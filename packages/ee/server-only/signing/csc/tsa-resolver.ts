import { NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { HttpTimestampAuthority, type TimestampAuthority } from '@libpdf/core';

import type { CscTransport } from './transport';
import { CscTspTimestampAuthority } from './tsp-timestamp-authority';

/**
 * Two-phase TSA resolution for the CSC transport.
 *
 * Phase 1 — sign time (PAdES B-T, per recipient signature).
 *   Each recipient's CMS gets a signature timestamp embedded as an unsigned
 *   attribute. {@link resolveCscSignTimeTsa} returns a libpdf-shaped
 *   `TimestampAuthority` bound to either the TSP's `signatures/timestamp`
 *   endpoint (authorised with the recipient's own service-scope bearer) or
 *   the operator's env-configured RFC 3161 TSA, whichever is configured.
 *   TSP wins precedence so a TSP-supplied TSA is the default when the TSP
 *   advertises the method.
 *
 * Phase 2 — seal time (PAdES B-LTA archival timestamp).
 *   The seal-document job emits one `/DocTimeStamp` over the fully-signed
 *   envelope. {@link resolveCscSealTimeTsa} returns the env-configured TSA
 *   only — the archival anchor SHOULD be a dedicated qualified archival
 *   TSA, independent of the per-recipient TSP. Using the TSP here would
 *   couple archive longevity to a TSP that may rotate or revoke, and seal
 *   time has no recipient context to carry a service-scope bearer anyway.
 *
 * Boot-time guard: {@link buildCscTransport} asserts
 * `NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY` is set unconditionally — seal
 * time always needs it, so making it env-or-fail at boot also satisfies
 * the sign-time fallback. The defensive throws inside the resolvers below
 * should be unreachable in practice.
 */

/**
 * Build a libpdf `TimestampAuthority` for a recipient's B-T sign-time
 * signature timestamp.
 *
 * Precedence: TSP first, env fallback. Selection is made up-front based on
 * the boot-discovered transport capability — we don't try TSP then fall
 * through to env on a runtime error. If the chosen source fails at call
 * time, the recipient's sign attempt fails (operator's recourse is to
 * configure env, which then wins on the next sign).
 *
 * `serviceToken` is the decrypted, non-expired service-scope bearer for
 * the current recipient — used only when the TSP source is selected.
 */
export const resolveCscSignTimeTsa = (transport: CscTransport, serviceToken: string): TimestampAuthority => {
  if (transport.supportsTimestamp) {
    return new CscTspTimestampAuthority({ transport, serviceToken });
  }

  const envUrls = parseTsaEnv(NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY());

  if (envUrls.length > 0) {
    return new HttpTimestampAuthority(envUrls[0]);
  }

  // Boot-time guard in `buildCscTransport` should have rejected this
  // configuration before any recipient hit this code path.
  throw new AppError(AppErrorCode.CSC_PROVIDER_NO_TSA, {
    message:
      'CSC sign-time TSA unresolved: TSP does not advertise signatures/timestamp and NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY is unset. This should have been caught by the boot-time guard in buildCscTransport.',
  });
};

/**
 * Resolve the seal-time archival TSA URLs (env only).
 *
 * Returns the parsed env list; the caller picks how to consume it (today
 * `finalize-tsp-completion.ts` uses the first URL).
 */
export const resolveCscSealTimeTsa = (): { urls: string[] } => {
  const envUrls = parseTsaEnv(NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY());

  if (envUrls.length === 0) {
    throw new AppError(AppErrorCode.CSC_PROVIDER_NO_TSA, {
      message:
        'CSC seal-time archival timestamps require NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY. This should have been caught by the boot-time guard in buildCscTransport — the env var is required at seal time even when the TSP advertises signatures/timestamp.',
    });
  }

  return { urls: envUrls };
};

/**
 * Cheap boot-time predicate — used by `buildCscTransport` to decide
 * whether the env TSA satisfies the "at least one source must be
 * configured" invariant. Keeping the env parsing in one place avoids
 * drift between the guard and the resolvers.
 */
export const isEnvTsaConfigured = (): boolean => {
  return parseTsaEnv(NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY()).length > 0;
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
