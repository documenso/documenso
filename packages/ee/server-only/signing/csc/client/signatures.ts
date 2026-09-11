import { cscJsonPost, joinCscUrl } from './http';
import {
  type TCscSignHashRequest,
  type TCscSignHashResponse,
  type TCscTimestampRequest,
  type TCscTimestampResponse,
  ZCscSignHashResponseSchema,
  ZCscTimestampResponseSchema,
} from './types';

type CscSignHashOptions = TCscSignHashRequest & {
  baseUrl: string;
  /** Service-scope bearer token. The SAD (in the body) is the credential-scope grant. */
  accessToken: string;
  signal?: AbortSignal;
};

/**
 * `signatures/signHash` (§11.9) — submit one or more pre-computed hashes for
 * the TSP to sign with the credential identified by `credentialID`.
 *
 * Authorisation is two-layered:
 * - The service-scope bearer token authenticates the API call itself.
 * - The credential-scope SAD (in the JSON body) authorises the specific
 *   hashes — the TSP rejects with `invalid_request` ("Hash is not authorized
 *   by the SAD") if any hash in the array wasn't bound at SAD issuance.
 *
 * The returned `signatures` array is position-ordered with `hash` per §11.9.
 * Callers SHALL preserve order when mapping responses back to PDF embed
 * slots (the fifoSigner relies on this).
 */
export const cscSignHash = async (opts: CscSignHashOptions): Promise<TCscSignHashResponse> => {
  const { baseUrl, accessToken, signal, credentialID, SAD, hash, hashAlgo, signAlgo, signAlgoParams, clientData } =
    opts;

  const body: Record<string, unknown> = {
    credentialID,
    SAD,
    hash,
    signAlgo,
  };

  if (hashAlgo !== undefined) {
    body.hashAlgo = hashAlgo;
  }

  if (signAlgoParams !== undefined) {
    body.signAlgoParams = signAlgoParams;
  }

  if (clientData !== undefined) {
    body.clientData = clientData;
  }

  return await cscJsonPost(
    {
      url: joinCscUrl({ baseUrl, path: 'signatures/signHash' }),
      body,
      accessToken,
      signal,
    },
    ZCscSignHashResponseSchema,
  );
};

type CscTimestampOptions = TCscTimestampRequest & {
  baseUrl: string;
  /**
   * Service-scope bearer token. Per §11.10 the timestamp endpoint may or may
   * not require auth depending on TSP policy; the spec is silent. We send the
   * token unconditionally because all known TSPs gate this endpoint.
   */
  accessToken: string;
  signal?: AbortSignal;
};

/**
 * `signatures/timestamp` (§11.10) — request an RFC 3161 / RFC 5816 time-stamp
 * token for a pre-computed hash. Driven by {@link CscTspTimestampAuthority}
 * at sign time, when {@link resolveCscSignTimeTsa} selects the TSP source
 * (TSP advertises `signatures/timestamp` in `info.methods`). The bearer is
 * the current recipient's own service-scope token. Seal-time archival
 * timestamps do not go through this endpoint — they use the env-configured
 * RFC 3161 TSA directly.
 *
 * If `nonce` is supplied, the TSP MUST round-trip it in the token — we leave
 * verification to LibPDF / our TSA helper, not this client.
 */
export const cscTimestamp = async (opts: CscTimestampOptions): Promise<TCscTimestampResponse> => {
  const { baseUrl, accessToken, signal, hash, hashAlgo, nonce, clientData } = opts;

  const body: Record<string, unknown> = { hash, hashAlgo };

  if (nonce !== undefined) {
    body.nonce = nonce;
  }

  if (clientData !== undefined) {
    body.clientData = clientData;
  }

  return await cscJsonPost(
    {
      url: joinCscUrl({ baseUrl, path: 'signatures/timestamp' }),
      body,
      accessToken,
      signal,
    },
    ZCscTimestampResponseSchema,
  );
};
