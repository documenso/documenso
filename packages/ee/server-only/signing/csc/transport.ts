import { IS_INSTANCE_CSC_MODE, NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { assertLicensedFor } from '@documenso/lib/server-only/license/assert-licensed-for';
import { requireEnv } from '@documenso/lib/utils/env';
import type { OAuth2Client } from 'arctic';

import { cscInfo } from './client/info';
import { createCscOAuthClient } from './client/oauth';
import type { TCscInfoResponse } from './client/types';
import { isEnvTsaConfigured } from './tsa-resolver';

/**
 * Lazily-built, globally-cached CSC transport.
 *
 * Boot-discovers `cscInfo` (§11.1) once, caches the OAuth base URL +
 * `signatures/timestamp` capability, and exposes a configured arctic
 * `OAuth2Client`. License + env + discovery are gated at construction so a
 * misconfigured instance fails at the first call site, not at sign time.
 *
 * Cached on `globalThis` so Hono routes and Remix loaders share one instance
 * across bundles (mirrors {@link LicenseClient}'s strategy).
 *
 * A failed build is **not** cached — the next caller retries. This keeps a
 * transient discovery hiccup from permanently breaking the transport while
 * still amortising the success path to one round-trip per process.
 */

const DISCOVERY_TIMEOUT_MS = 10_000;

const CSC_TIMESTAMP_METHOD = 'signatures/timestamp';

export type CscTransport = {
  /** Service base URI from `NEXT_PRIVATE_SIGNING_CSC_PROVIDER_BASE_URL`. */
  serviceBaseUrl: string;
  /** OAuth base URI from `info.oauth2` (§11.1). MAY differ from `serviceBaseUrl`. */
  oauthBaseUrl: string;
  /** Pre-configured arctic client bound to the TSP's OAuth registration. */
  oauthClient: OAuth2Client;
  /**
   * Documenso's callback URL registered with the TSP. Derived from
   * `NEXT_PUBLIC_WEBAPP_URL` and the fixed `/api/csc/oauth/callback` mount —
   * mirrors `packages/auth/server/config.ts` for the sign-in OAuth providers.
   * Operators must register this exact URL with the TSP.
   */
  oauthRedirectUri: string;
  /** True when the TSP advertises `signatures/timestamp` in `info.methods`. */
  supportsTimestamp: boolean;
  /** Raw discovery response, exposed for callers needing other fields (`name`, `region`, `lang`). */
  info: TCscInfoResponse;
};

declare global {
  // eslint-disable-next-line no-var
  var __documenso_csc_transport__: CscTransport | undefined;
  // eslint-disable-next-line no-var
  var __documenso_csc_transport_promise__: Promise<CscTransport> | undefined;
}

/**
 * Get the current CSC transport, building + caching it on first call.
 *
 * Throws:
 * - `NOT_SETUP` — instance is not in CSC mode, or a required env var is unset.
 * - `CSC_UNLICENSED` — `instanceCscSigning` license flag missing.
 * - `CSC_PROVIDER_INFO_FAILED` — `info` discovery failed or response omits
 *   the REQUIRED `oauth2` base URL.
 *
 * Safe to call concurrently — a second call during in-flight discovery
 * awaits the same promise instead of starting a duplicate request.
 */
export const getCscTransport = async (): Promise<CscTransport> => {
  if (globalThis.__documenso_csc_transport__) {
    return globalThis.__documenso_csc_transport__;
  }

  if (!globalThis.__documenso_csc_transport_promise__) {
    globalThis.__documenso_csc_transport_promise__ = buildCscTransport()
      .then((transport) => {
        globalThis.__documenso_csc_transport__ = transport;
        return transport;
      })
      .finally(() => {
        globalThis.__documenso_csc_transport_promise__ = undefined;
      });
  }

  return await globalThis.__documenso_csc_transport_promise__;
};

/**
 * Drop the cached transport. Intended for tests / operator-triggered reload
 * after a license-key swap. Next {@link getCscTransport} call re-runs the
 * full build pipeline (license + env + discovery).
 */
export const resetCscTransport = (): void => {
  globalThis.__documenso_csc_transport__ = undefined;
  globalThis.__documenso_csc_transport_promise__ = undefined;
};

const buildCscTransport = async (): Promise<CscTransport> => {
  if (!IS_INSTANCE_CSC_MODE()) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: 'CSC transport requested but NEXT_PRIVATE_SIGNING_TRANSPORT is not "csc".',
    });
  }

  await assertLicensedFor('instanceCscSigning', { errorCode: AppErrorCode.CSC_UNLICENSED });

  const serviceBaseUrl = requireEnv('NEXT_PRIVATE_SIGNING_CSC_PROVIDER_BASE_URL');
  const clientId = requireEnv('NEXT_PRIVATE_SIGNING_CSC_OAUTH_CLIENT_ID');
  const clientSecret = requireEnv('NEXT_PRIVATE_SIGNING_CSC_OAUTH_CLIENT_SECRET');
  const oauthRedirectUri = `${NEXT_PUBLIC_WEBAPP_URL()}/api/csc/oauth/callback`;

  const oauthClient = createCscOAuthClient({ clientId, clientSecret, redirectUri: oauthRedirectUri });

  const info = await cscInfo({
    baseUrl: serviceBaseUrl,
    signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
  });

  if (!info.oauth2) {
    throw new AppError(AppErrorCode.CSC_PROVIDER_INFO_FAILED, {
      message:
        'CSC TSP info response omits the required `oauth2` base URL. CSC QES V1 only supports OAuth-based authorization (§8.3) — non-OAuth TSPs are not compatible.',
    });
  }

  const supportsTimestamp = info.methods.includes(CSC_TIMESTAMP_METHOD);

  // Boot-time TSA invariant: `NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY` is
  // required unconditionally in CSC mode. Sign-time B-T can use the TSP's
  // own `signatures/timestamp` endpoint when advertised, but seal-time
  // B-LTA archival is env-only by design (operators should pin a dedicated
  // qualified archival TSA — see `resolveCscSealTimeTsa`). Without env, an
  // envelope would sign successfully and then hang in
  // WAITING_FOR_SIGNATURE_COMPLETION when the seal job throws. Catch the
  // misconfiguration at boot instead so the instance refuses to start.
  if (!isEnvTsaConfigured()) {
    throw new AppError(AppErrorCode.CSC_PROVIDER_NO_TSA, {
      message:
        'NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY is unset. AES/QES envelopes require a TSA for B-LTA archival at seal time regardless of whether the CSC TSP advertises signatures/timestamp for B-T sign-time. Configure NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY.',
    });
  }

  return {
    serviceBaseUrl,
    oauthBaseUrl: info.oauth2,
    oauthClient,
    oauthRedirectUri,
    supportsTimestamp,
    info,
  };
};
